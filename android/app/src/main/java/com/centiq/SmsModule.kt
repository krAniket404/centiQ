package com.centiq

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import com.facebook.react.bridge.*
import androidx.core.content.ContextCompat

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
                    "date DESC LIMIT 100"
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
}