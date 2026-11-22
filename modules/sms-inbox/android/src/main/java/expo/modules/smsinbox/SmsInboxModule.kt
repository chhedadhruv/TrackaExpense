package expo.modules.smsinbox

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads recent SMS from the inbox for the bank message import. Only messages from a named sender
 * (an id with a letter in it, such as "VM-HDFCBK") are returned: messages from phone numbers are
 * skipped here and never reach JavaScript. Nothing is stored or sent by this module.
 */
class SmsInboxModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsInbox")

    AsyncFunction("readNamedSenderMessages") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS)
        != PackageManager.PERMISSION_GRANTED
      ) {
        throw CodedException("ERR_SMS_PERMISSION", "READ_SMS is not granted", null)
      }

      val messages = mutableListOf<Map<String, Any>>()
      try {
        context.contentResolver.query(
          Telephony.Sms.Inbox.CONTENT_URI,
          arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
          "${Telephony.Sms.DATE} >= ?",
          arrayOf(sinceMs.toLong().toString()),
          "${Telephony.Sms.DATE} DESC"
        )?.use { cursor ->
          val addressIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
          val bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
          val dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
          while (cursor.moveToNext() && messages.size < limit) {
            val address = cursor.getString(addressIndex) ?: continue
            if (!address.any { it.isLetter() }) {
              continue
            }
            val body = cursor.getString(bodyIndex) ?: continue
            messages.add(
              mapOf(
                "sender" to address,
                "body" to body,
                "date" to cursor.getLong(dateIndex).toDouble()
              )
            )
          }
        }
      } catch (e: SecurityException) {
        throw CodedException("ERR_SMS_PERMISSION", "READ_SMS was refused", e)
      }
      messages
    }
  }
}
