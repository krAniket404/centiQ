package com.centiq

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.content.Intent
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class QNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName

        // 1. Expanded list of UPI and Banking apps
        val targetPackages = listOf(
            "com.google.android.apps.nbu.paisa.user", // Google Pay
            "com.phonepe.app",                        // PhonePe
            "net.one97.paytm",                        // Paytm
            "com.csam.icici.bank.imobile",            // ICICI
            "com.infrasoft.ltd.sbi.SBIFreedomPlus",   // SBI
            "com.mobikwik",                           // MobiKwik
            "com.whatsapp",                           // WhatsApp (Bank alerts)
            "com.freecharge.android",                 // Freecharge
            "com.upi.axispay",                        // Axis Pay
            "in.amazon.mShop.android.shopping",       // Amazon Pay
            "com.slice.gold",                         // Slice
            "com.dreamplug.android.cred",             // CRED
            "in.jupiter",                             // Jupiter
            "com.niyo.equitas"                        // Niyo
        )

        if (targetPackages.contains(packageName)) {
            val extras = sbn.notification.extras
            val title = extras.getString("android.title") ?: ""
            val text = extras.getCharSequence("android.text")?.toString() ?: ""

            val fullText = "$title $text"
            val lowerText = fullText.lowercase()

            // 2. MUST contain a transaction keyword
            val txnKeywords = listOf("debited", "credited", "spent", "sent", "paid", "received", "withdrawn", "transfer", "upi ref", "imps", "neft", "₹", "rs.", "inr")
            val hasTxnKeyword = txnKeywords.any { lowerText.contains(it) }

            // 3. MUST NOT contain these non-transaction keywords
            val ignoreKeywords = listOf("balance", "available", "limit", "statement", "offer", "reward", "cashback", "emi due", "kyc", "otp")
            val hasIgnoreKeyword = ignoreKeywords.any { lowerText.contains(it) }

            // 4. If it passes filters, check for amount and debit
            if (hasTxnKeyword && !hasIgnoreKeyword) {
                val regex = Regex("(?:rs|inr|₹)\\s*\\.?\\s*(\\d[\\d,\\.]*)", RegexOption.IGNORE_CASE)
                if (regex.containsMatchIn(fullText)) {
                    Log.d("QNotifListener", "Valid transaction detected: $fullText")

                    // Send to JS for logging
                    sendEvent("transaction_notification", fullText)

                    // 5. Trigger behavioral notification ONLY for debits
                    val debitKeywords = listOf("debited", "spent", "paid", "sent", "withdrawn", "to ")
                    if (debitKeywords.any { lowerText.contains(it) }) {
                        showBehaviorNotification(sbn.id)
                    }
                }
            }
        }
    }

    private fun showBehaviorNotification(notificationId: Int) {
        val channelId = "centiq_transactions"
        val context = this

        val worthItIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "com.centiq.ACTION_WORTH_IT"
        }
        val impulsiveIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "com.centiq.ACTION_IMPULSIVE"
        }

        val worthItPendingIntent = PendingIntent.getBroadcast(
            context, notificationId + 1, worthItIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val impulsivePendingIntent = PendingIntent.getBroadcast(
            context, notificationId + 2, impulsiveIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent to open the app (Fix #5)
        val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val openAppPendingIntent = PendingIntent.getActivity(
            context, notificationId + 3, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("💸 Transaction Detected")
            .setContentText("Was this purchase impulsive?")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openAppPendingIntent)
            .setAutoCancel(true)
            .addAction(0, "✅ Worth it", worthItPendingIntent)
            .addAction(0, "❤️‍🔥 Impulsive", impulsivePendingIntent)

        try {
            NotificationManagerCompat.from(context).notify(1001, builder.build())
        } catch (e: SecurityException) {}
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
