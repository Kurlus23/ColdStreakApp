#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Capacitor plugin registration. Must match the @objc class name in
// ColdstreakMusickitPlugin.swift and the JS-side registerPlugin name
// ("ColdstreakMusickit").
CAP_PLUGIN(ColdstreakMusickitPlugin, "ColdstreakMusickit",
  CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getUserToken, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(playPlaylist, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(pause, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(resume, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(skipNext, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(skipPrevious, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
)
