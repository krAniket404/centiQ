package com.centiq

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import com.facebook.react.bridge.*
import androidx.core.content.ContextCompat
import android.content.Context

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun readBankSMS(promise: Promise) {
        Thread {
            try {
                val cursor = reactApplicationContext.contentResolver.query(
                    Uri.parse("content://sms/inbox"),
                    arrayOf("body", "date"),
                    "body LIKE ? OR body LIKE ? OR body LIKE ?",
                    arrayOf("%Rs%", "%INR%", "%₹%"),
                    "date DESC LIMIT 1000"
                )

                val smsList = Arguments.createArray()
                cursor?.use {
                    while (it.moveToNext()) {
                        val body = it.getString(0)
                        val date = it.getLong(1)
                        val map = Arguments.createMap()
                        map.putString("body", body)
                        map.putDouble("date", date.toDouble())
                        smsList.pushMap(map)
                    }
                }
                promise.resolve(smsList)
            } catch (e: Exception) {
                promise.reject("SMS_READ_ERROR", e)
            }
        }.start()
    }

    // Change 'daysBack: Int' to 'daysBack: Double'
    @ReactMethod
    fun getHistoricalSms(daysBack: Double, promise: Promise) {
        Thread {
            try {
                val resolver = reactApplicationContext.contentResolver

                // Convert Double to Int safely
                val days = daysBack.toInt()
                val cutoffMillis = System.currentTimeMillis() - (days.toLong() * 24 * 60 * 60 * 1000)
                val projection = arrayOf(
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE
                )

                val selection = "${Telephony.Sms.DATE} >= ?"
                val selectionArgs = arrayOf(cutoffMillis.toString())

                val cursor = resolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    "${Telephony.Sms.DATE} DESC"
                )

                val results = Arguments.createArray()
                val transactionalKeywords = listOf("Rs", "INR", "debited", "credited", "spent", "sent", "withdrawn")

                cursor?.use {
                    val addressIdx = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                    val bodyIdx = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                    val dateIdx = it.getColumnIndexOrThrow(Telephony.Sms.DATE)

                    while (it.moveToNext()) {
                        val body = it.getString(bodyIdx) ?: continue
                        val isTransactional = transactionalKeywords.any { kw -> body.contains(kw, ignoreCase = true) }
                        if (!isTransactional) continue

                        val map = Arguments.createMap()
                        map.putString("sender", it.getString(addressIdx) ?: "")
                        map.putString("body", body)
                        map.putDouble("date", it.getLong(dateIdx).toDouble()) // Changed from timestamp to date
                        results.pushMap(map)
                    }
                }

                promise.resolve(results)
            } catch (e: Exception) {
                promise.reject("SMS_HISTORY_ERROR", "Failed to read SMS history: ${e.message}", e)
            }
        }.start()
    }

    @ReactMethod
    fun saveData(key: String, value: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("CentiQStorage", Context.MODE_PRIVATE)
            prefs.edit().putString(key, value).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STORAGE_SAVE_ERROR", e)
        }
    }

    @ReactMethod
    fun loadData(key: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("CentiQStorage", Context.MODE_PRIVATE)
            val value = prefs.getString(key, null)
            promise.resolve(value) // resolves to null (not an error) if nothing was saved yet
        } catch (e: Exception) {
            promise.reject("STORAGE_LOAD_ERROR", e)
        }
    }

}