package com.centiq // REPLACE WITH YOUR PACKAGE NAME

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule

class QNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName

        // 1. Only listen to UPI and Banking apps
        val targetPackages = listOf(
            "com.google.android.apps.nbu.paisa.user", // Google Pay
            "com.phonepe.app",                        // PhonePe
            "net.one97.paytm",                        // Paytm
            "com.csam.icici.bank.imobile",            // ICICI
            "com.infrasoft.ltd.sbi.SBIFreedomPlus",   // SBI
            "com.mobikwik",                           // MobiKwik
            "com.whatsapp"                            // Sometimes banks send via WhatsApp now
        )

        if (targetPackages.contains(packageName)) {
            val extras = sbn.notification.extras
            val title = extras.getString("android.title") ?: ""
            val text = extras.getCharSequence("android.text")?.toString() ?: ""

            val fullText = "$title $text"
            val lowerText = fullText.lowercase()

            // 2. MUST contain a transaction keyword
            val txnKeywords = listOf("debited", "credited", "spent", "sent", "paid", "received", "withdrawn", "transfer", "upi ref", "imps", "neft")
            val hasTxnKeyword = txnKeywords.any { lowerText.contains(it) }

            // 3. MUST NOT contain these non-transaction keywords
            val ignoreKeywords = listOf("balance", "available", "limit", "statement", "offer", "reward", "cashback", "emi due", "kyc")
            val hasIgnoreKeyword = ignoreKeywords.any { lowerText.contains(it) }

            // 4. If it passes both filters, check for the amount
            if (hasTxnKeyword && !hasIgnoreKeyword) {
                val regex = Regex("(?:rs|inr|₹)\\s*\\.?\\s*(\\d[\\d,\\.]*)", RegexOption.IGNORE_CASE)
                if (regex.containsMatchIn(fullText)) {
                    Log.d("QNotifListener", "Valid transaction detected: $fullText")
                    sendEvent("transaction_notification", fullText)
                }
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