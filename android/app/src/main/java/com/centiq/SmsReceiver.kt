package com.centiq

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            val messageBody = messages.joinToString { it.displayMessageBody }
            val lowerBody = messageBody.lowercase()

            // 1. MUST contain a transaction keyword
            val txnKeywords = listOf("rs", "inr", "₹", "debited", "spent", "paid", "sent", "withdrawn")
            val hasTxnKeyword = txnKeywords.any { lowerBody.contains(it) }

            // 2. ONLY notify for debit transactions (Fix #1)
            val debitKeywords = listOf("debited", "spent", "paid", "sent", "withdrawn", "dr.")
            val isDebit = debitKeywords.any { lowerBody.contains(it) }

            if (hasTxnKeyword && isDebit) {
                showTransactionNotification(context)
            }
        }
    }

    private fun showTransactionNotification(context: Context) {
        val channelId = "centiq_transactions"

        // Create Notification Channel (Required for Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                channelId,
                "Q Transactions",
                android.app.NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new transactions"
            }
            val notificationManager: android.app.NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.createNotificationChannel(channel)
        }

        // Create Intents for the buttons
        val worthItIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "com.centiq.ACTION_WORTH_IT"
        }
        val impulsiveIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "com.centiq.ACTION_IMPULSIVE"
        }

        val worthItPendingIntent = PendingIntent.getBroadcast(
            context, 0, worthItIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val impulsivePendingIntent = PendingIntent.getBroadcast(
            context, 1, impulsiveIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent to open the app (Fix #5)
        val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val openAppPendingIntent = PendingIntent.getActivity(
            context, 2, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("💸 New Transaction Detected")
            .setContentText("Was this purchase impulsive? Log it for your ML model.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openAppPendingIntent)
            .setAutoCancel(true)
            // Add the Action Buttons
            .addAction(0, "✅ Worth it", worthItPendingIntent)
            .addAction(0, "❤️‍🔥 Impulsive", impulsivePendingIntent)

        try {
            NotificationManagerCompat.from(context).notify(1001, builder.build())
        } catch (e: SecurityException) {
            // Handle missing permission gracefully
        }
    }
}