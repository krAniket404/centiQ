package com.centiq // REPLACE WITH YOUR PACKAGE NAME

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule

class QNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName

        // 1. Filter for UPI and Banking apps
        val targetPackages = listOf(
            "com.google.android.apps.nbu.paisa.user", // Google Pay
            "com.phonepe.app",                        // PhonePe
            "net.one97.paytm",                        // Paytm
            "com.csam.icici.bank.imobile",            // ICICI
            "com.infrasoft.ltd.sbi.SBIFreedomPlus",   // SBI
            "com.mobikwik"                            // Add more as needed
        )

        if (targetPackages.contains(packageName)) {
            val extras = sbn.notification.extras
            val title = extras.getString("android.title") ?: ""
            val text = extras.getCharSequence("android.text")?.toString() ?: ""

            val fullText = "$title $text"

            // 2. Quick check if it contains an amount
            val regex = Regex("(?:RS|INR|Rs\\.?)\\s*\\.?\\s*(\\d[\\d,\\.]*)", RegexOption.IGNORE_CASE)
            if (regex.containsMatchIn(fullText)) {
                Log.d("QNotifListener", "Transaction detected: $fullText")
                sendEvent("transaction_notification", fullText)
            }
        }
    }

    private fun sendEvent(eventName: String, params: String) {
        try {
            val context = ReactContextSingleton.reactContext
            context?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (e: Exception) {
            Log.e("QNotifListener", "RN Context not available yet", e)
        }
    }
}