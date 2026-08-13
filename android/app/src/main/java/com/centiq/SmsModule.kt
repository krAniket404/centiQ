package com.centiq

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import com.facebook.react.bridge.*
import androidx.core.content.ContextCompat
import android.content.Context
import android.content.Intent
import android.app.PendingIntent

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    override fun initialize() {
        super.initialize()
        ReactContextSingleton.reactContext = reactApplicationContext
    }

    @ReactMethod
    fun openNotificationSettings() {
        try {
            val intent = android.content.Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Fallback just in case
        }
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

    @ReactMethod
    fun getPendingNotifLabel(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("centiq_notif_data", Context.MODE_PRIVATE)
            val hasPending = prefs.getBoolean("has_pending_label", false)
            val isImpulsive = prefs.getBoolean("pending_label_value", false)

            if (hasPending) {
                // Clear the flag so we don't read it twice
                prefs.edit().remove("has_pending_label").remove("pending_label_value").apply()

                val map = Arguments.createMap()
                map.putString("status", "found")
                map.putBoolean("isImpulsive", isImpulsive)
                promise.resolve(map)
            } else {
                val map = Arguments.createMap()
                map.putString("status", "empty")
                promise.resolve(map)
            }
        } catch (e: Exception) {
            promise.reject("NOTIF_READ_ERROR", e)
        }
    }
    @ReactMethod
    fun scheduleDailyReminder(hour: Int, minute: Int, title: String, message: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, DailyReminderReceiver::class.java).apply {
                action = "com.centiq.DAILY_REMINDER"
                putExtra("title", title)
                putExtra("message", message)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context, 999, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val calendar = java.util.Calendar.getInstance().apply {
                set(java.util.Calendar.HOUR_OF_DAY, hour)
                set(java.util.Calendar.MINUTE, minute)
                set(java.util.Calendar.SECOND, 0)
            }

            // If the time has passed today, schedule for tomorrow
            if (calendar.timeInMillis <= System.currentTimeMillis()) {
                calendar.add(java.util.Calendar.DAY_OF_YEAR, 1)
            }

            // Set repeating alarm for every day
            alarmManager.setInexactRepeating(
                android.app.AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                android.app.AlarmManager.INTERVAL_DAY,
                pendingIntent
            )
            promise.resolve("Scheduled")
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e)
        }
    }
}