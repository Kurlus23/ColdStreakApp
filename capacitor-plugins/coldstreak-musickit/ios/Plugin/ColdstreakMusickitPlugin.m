#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Capacitor plugin registration. Must match the @objc class name in
// ColdstreakMusickitPlugin.swift and the JS-side registerPlugin name
// ("ColdstreakMusickit").
CAP_PLUGIN(ColdstreakMusickitPlugin, "ColdstreakMusickit",
  CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getUserToken, CAPPluginReturnPromise);
)
