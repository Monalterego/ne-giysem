package expo.modules.garmentcutout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ExecutionException
import kotlin.math.max

// Cihaz üstü kıyafet kesimi. Görsel cihazdan çıkmaz.
// ML Kit Subject Segmentation (beta) → özne bitmap'leri → beyaz zemine birleştir → JPEG
// (uygulama cache'i, garment-cutout/). Tüm kare çıktısı (foreground bitmap) yerine özne
// bitmap'leri kullanılır: tüm kare çıktısında çökme bildirilmiş (@rbayuokt/expo-background-removal notu).
class GarmentCutoutModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context yok")

  override fun definition() = ModuleDefinition {
    Name("GarmentCutout")

    AsyncFunction("isSupported") { promise: Promise ->
      val status = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
      if (status == ConnectionResult.SUCCESS) {
        promise.resolve(mapOf("supported" to true))
      } else {
        promise.resolve(mapOf("supported" to false, "reason" to "no-play-services"))
      }
    }

    // AsyncFunction arka plan kuyruğunda çalışır → Tasks.await ana iş parçacığını bloklamaz
    AsyncFunction("cutout") { uri: String, promise: Promise ->
      try {
        promise.resolve(cutout(uri))
      } catch (e: ExecutionException) {
        val cause = e.cause
        if (cause is MlKitException && cause.errorCode == MlKitException.UNAVAILABLE) {
          // Model henüz inmedi — bu istek sonuç vermez, sonra yeniden denenebilir
          promise.reject("ERR_MODEL_DOWNLOADING", "Kesim modeli henüz indirilmedi", cause)
        } else {
          promise.reject("ERR_CUTOUT", cause?.message ?: e.message, cause ?: e)
        }
      } catch (e: Exception) {
        promise.reject("ERR_CUTOUT", e.message, e)
      }
    }

    AsyncFunction("flattenOnWhite") { uri: String, promise: Promise ->
      try {
        val source = loadBitmap(uri)
        val out = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
        Canvas(out).apply {
          drawColor(Color.WHITE)
          drawBitmap(source, 0f, 0f, null)
        }
        promise.resolve(writeJpeg(out))
      } catch (e: Exception) {
        promise.reject("ERR_CUTOUT", e.message, e)
      }
    }
  }

  // ─── Kesim ──────────────────────────────────────────────────────────────────

  /** Özne bulunamazsa null */
  private fun cutout(uri: String): Map<String, Any>? {
    val bitmap = loadBitmap(uri)
    val options = SubjectSegmenterOptions.Builder()
      .enableMultipleSubjects(
        SubjectSegmenterOptions.SubjectResultOptions.Builder()
          .enableSubjectBitmap()
          .build()
      )
      .build()
    val segmenter = SubjectSegmentation.getClient(options)
    try {
      val result = Tasks.await(segmenter.process(InputImage.fromBitmap(bitmap, 0)))
      val subjects = result.subjects.filter { it.bitmap != null }
      if (subjects.isEmpty()) return null

      // Tüm öznelerin sınırına kırp, çevresine beyaz pay bırak
      val left = subjects.minOf { it.startX }
      val top = subjects.minOf { it.startY }
      val right = subjects.maxOf { it.startX + it.width }
      val bottom = subjects.maxOf { it.startY + it.height }
      val width = right - left
      val height = bottom - top
      val margin = (max(width, height) * CUTOUT_MARGIN).toInt()

      val out = Bitmap.createBitmap(width + 2 * margin, height + 2 * margin, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(out)
      canvas.drawColor(Color.WHITE)
      for (subject in subjects) {
        canvas.drawBitmap(
          subject.bitmap!!,
          (subject.startX - left + margin).toFloat(),
          (subject.startY - top + margin).toFloat(),
          null
        )
      }
      return writeJpeg(out)
    } finally {
      segmenter.close()
    }
  }

  // ─── Yardımcılar ────────────────────────────────────────────────────────────

  /** file:// ya da content:// → bitmap (girdi toUploadJpeg çıktısı: yönü zaten düz) */
  private fun loadBitmap(uri: String): Bitmap {
    val parsed = if (uri.startsWith("/")) Uri.fromFile(File(uri)) else Uri.parse(uri)
    val stream = context.contentResolver.openInputStream(parsed)
      ?: throw IllegalArgumentException("Görsel açılamadı")
    val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
    return stream.use { BitmapFactory.decodeStream(it, null, options) }
      ?: throw IllegalArgumentException("Görsel okunamadı")
  }

  private fun writeJpeg(bitmap: Bitmap): Map<String, Any> {
    val dir = File(context.cacheDir, "garment-cutout").apply { mkdirs() }
    val file = File(dir, "${UUID.randomUUID()}.jpg")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }
    return mapOf(
      "uri" to Uri.fromFile(file).toString(),
      "width" to bitmap.width,
      "height" to bitmap.height,
    )
  }

  companion object {
    private const val CUTOUT_MARGIN = 0.06f
    private const val JPEG_QUALITY = 90
  }
}
