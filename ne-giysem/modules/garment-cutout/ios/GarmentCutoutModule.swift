import CoreImage
import ExpoModulesCore
import UIKit
import Vision

// Cihaz üstü kıyafet kesimi. Görsel cihazdan çıkmaz.
// iOS 17+: VNGenerateForegroundInstanceMaskRequest → generateMaskedImage (arka plan saydam)
// → beyaz zemine birleştir → JPEG (uygulama cache'i, garment-cutout/).
public class GarmentCutoutModule: Module {
  // Kesimin çevresine bırakılan beyaz pay (uzun kenarın oranı) — sticker görünümü
  static let cutoutMargin: CGFloat = 0.06
  static let jpegQuality: CGFloat = 0.9

  public func definition() -> ModuleDefinition {
    Name("GarmentCutout")

    AsyncFunction("isSupported") { () -> [String: Any] in
      #if targetEnvironment(simulator)
      return ["supported": false, "reason": "simulator"]
      #else
      if #available(iOS 17.0, *) {
        return ["supported": true]
      }
      return ["supported": false, "reason": "os"]
      #endif
    }

    AsyncFunction("cutout") { (uri: String, promise: Promise) in
      guard #available(iOS 17.0, *) else {
        promise.reject("ERR_UNSUPPORTED", "Cihaz üstü kesim iOS 17 gerektirir")
        return
      }
      // Vision ağır iş — JS ve ana iş parçacığı dışında
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try GarmentCutoutModule.cutout(uri: uri))
        } catch {
          promise.reject("ERR_CUTOUT", error.localizedDescription)
        }
      }
    }

    // Kayıttan / vazgeçmeden sonra: garment-cutout/ cache klasörünü boşalt
    AsyncFunction("clearCache") { () in
      try? FileManager.default.removeItem(at: GarmentCutoutModule.cacheDir())
    }

    // uri: file:// / mutlak yol ya da data:image/...;base64,... (packshot çıktısı)
    AsyncFunction("flattenOnWhite") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let image = CIImage(cgImage: try GarmentCutoutModule.loadUprightImage(uri))
          promise.resolve(try GarmentCutoutModule.writeOnWhite(image, margin: 0))
        } catch {
          promise.reject("ERR_CUTOUT", error.localizedDescription)
        }
      }
    }
  }

  // ─── Kesim ──────────────────────────────────────────────────────────────────

  /** Özne bulunamazsa nil */
  @available(iOS 17.0, *)
  static func cutout(uri: String) throws -> [String: Any]? {
    let image = try loadUprightImage(uri)
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      return nil
    }
    // Tüm özneler (askı / aksesuar da dahil olabilir), özne sınırına kırpılmış
    let masked = try observation.generateMaskedImage(
      ofInstances: observation.allInstances,
      from: handler,
      croppedToInstancesExtent: true
    )
    return try writeOnWhite(CIImage(cvPixelBuffer: masked), margin: cutoutMargin)
  }

  // ─── Yardımcılar ────────────────────────────────────────────────────────────

  struct CutoutError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }

  static func cacheDir() -> URL {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("garment-cutout", isDirectory: true)
  }

  /** file:// / mutlak yol / data URI → yönü düzeltilmiş CGImage (Vision yön bilgisini okumasın) */
  static func loadUprightImage(_ uri: String) throws -> CGImage {
    let loaded: UIImage?
    if uri.hasPrefix("data:"), let comma = uri.firstIndex(of: ",") {
      loaded = Data(base64Encoded: String(uri[uri.index(after: comma)...])).flatMap { UIImage(data: $0) }
    } else {
      let url = URL(string: uri).flatMap { $0.isFileURL ? $0 : nil } ?? URL(fileURLWithPath: uri)
      loaded = UIImage(contentsOfFile: url.path)
    }
    guard let image = loaded else {
      throw CutoutError(message: "Görsel okunamadı")
    }
    if image.imageOrientation == .up, let cg = image.cgImage {
      return cg
    }
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = image.scale
    format.opaque = false
    let upright = UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
    guard let cg = upright.cgImage else {
      throw CutoutError(message: "Görsel çevrilemedi")
    }
    return cg
  }

  /** Saydam görüntüyü beyaz zemine birleştirip cache'e JPEG yazar */
  static func writeOnWhite(_ image: CIImage, margin ratio: CGFloat) throws -> [String: Any] {
    let extent = image.extent
    let margin = max(extent.width, extent.height) * ratio
    let canvas = extent.insetBy(dx: -margin, dy: -margin).integral
    let white = CIImage(color: CIColor.white).cropped(to: canvas)
    let composed = image.composited(over: white)

    guard let output = CIContext(options: nil).createCGImage(composed, from: canvas),
          let data = UIImage(cgImage: output).jpegData(compressionQuality: jpegQuality) else {
      throw CutoutError(message: "Görsel yazılamadı")
    }

    let dir = cacheDir()
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent("\(UUID().uuidString).jpg")
    try data.write(to: file)

    return ["uri": file.absoluteString, "width": output.width, "height": output.height]
  }
}
