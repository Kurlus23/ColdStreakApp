import Foundation
import Capacitor
import HealthKit

/// Capacitor plugin that gives the iPhone JS app read-only access to Apple Health
/// for heart rate and HRV data. This is the bridge that lets ColdStreak enrich
/// plunges logged on the iPhone with HR/HRV pulled from any device that syncs
/// to Apple Health (Apple Watch, Garmin, Whoop, Fitbit, Oura, T-Rex via 3rd-party
/// sync apps, etc.).
///
/// JS USAGE (in client/src):
///   import { registerPlugin } from '@capacitor/core';
///   const HealthKit = registerPlugin<{
///     isAvailable: () => Promise<{ available: boolean }>;
///     requestAuth: () => Promise<{ granted: boolean }>;
///     getHrAvg: (opts: { startMs: number; endMs: number }) => Promise<{ avg: number | null; samples: number }>;
///     getRecentHrv: (opts: { lookbackMinutes: number }) => Promise<{ avgMs: number | null; samples: number }>;
///   }>('HealthKit');
///
/// SETUP IN XCODE:
///   1. Drag this file into the iOS App target (App → App folder)
///   2. In Signing & Capabilities → + Capability → HealthKit
///   3. In Info.plist add:
///        NSHealthShareUsageDescription =
///          "ColdStreak reads heart rate and HRV during your plunges to estimate strain and recovery."
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHrAvg", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecentHrv", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuth(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        let read: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
        ]
        store.requestAuthorization(toShare: nil, read: read) { success, _ in
            call.resolve(["granted": success])
        }
    }

    @objc func getHrAvg(_ call: CAPPluginCall) {
        let startMs = call.getDouble("startMs") ?? 0
        let endMs = call.getDouble("endMs") ?? 0
        guard startMs > 0, endMs > startMs,
              let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            call.resolve(["avg": NSNull(), "samples": 0])
            return
        }

        let start = Date(timeIntervalSince1970: startMs / 1000.0)
        let end = Date(timeIntervalSince1970: endMs / 1000.0)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let unit = HKUnit.count().unitDivided(by: .minute())

        let q = HKSampleQuery(
            sampleType: hrType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, _ in
            guard let samples = samples as? [HKQuantitySample], !samples.isEmpty else {
                call.resolve(["avg": NSNull(), "samples": 0])
                return
            }
            let bpms = samples.map { $0.quantity.doubleValue(for: unit) }
            let avg = bpms.reduce(0, +) / Double(bpms.count)
            call.resolve(["avg": Int(avg.rounded()), "samples": bpms.count])
        }
        store.execute(q)
    }

    /// Pulls the average HRV (SDNN, ms) from the last `lookbackMinutes` minutes.
    /// HRV is captured passively by Apple Health (and watches that sync to it),
    /// usually during quiet moments — this gives us a snapshot of recent autonomic state.
    @objc func getRecentHrv(_ call: CAPPluginCall) {
        let lookback = call.getInt("lookbackMinutes") ?? 60
        guard let hrvType = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) else {
            call.resolve(["avgMs": NSNull(), "samples": 0])
            return
        }

        let end = Date()
        let start = end.addingTimeInterval(-Double(lookback) * 60)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let unit = HKUnit.secondUnit(with: .milli)

        let q = HKSampleQuery(
            sampleType: hrvType,
            predicate: predicate,
            limit: 50,
            sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
        ) { _, samples, _ in
            guard let samples = samples as? [HKQuantitySample], !samples.isEmpty else {
                call.resolve(["avgMs": NSNull(), "samples": 0])
                return
            }
            let ms = samples.map { $0.quantity.doubleValue(for: unit) }
            let avg = ms.reduce(0, +) / Double(ms.count)
            call.resolve(["avgMs": avg.rounded(), "samples": ms.count])
        }
        store.execute(q)
    }
}
