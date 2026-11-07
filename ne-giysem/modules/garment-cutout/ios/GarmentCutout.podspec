Pod::Spec.new do |s|
  s.name           = 'GarmentCutout'
  s.version        = '0.1.0'
  s.summary        = 'Cihaz üstü kıyafet kesimi (Vision)'
  s.description    = 'iOS 17+ VNGenerateForegroundInstanceMaskRequest ile kıyafet kesimi ve beyaz zemine birleştirme'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # Uygulamanın hedefi (SDK 56: iOS 16.4) — Vision kesimi çalışma zamanında iOS 17 ile korunur
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
