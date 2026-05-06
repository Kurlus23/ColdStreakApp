require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'ColdstreakMusickit'
  s.version          = package['version']
  s.summary          = package['description']
  s.license          = 'MIT'
  s.homepage         = 'https://coldstreakapp.com'
  s.authors          = { 'ColdStreak' => 'support@coldstreakapp.com' }
  s.source           = { :git => 'https://coldstreakapp.com', :tag => s.version.to_s }
  s.source_files     = 'ios/Plugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  # Link the iOS-system frameworks our Swift code uses. Without these the
  # Pod target won't find `import MusicKit` / `import StoreKit` etc.
  s.frameworks       = 'StoreKit', 'MediaPlayer', 'MusicKit'
  s.swift_version    = '5.1'
end
