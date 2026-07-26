package com.centiq

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        // Cancel the notification since they clicked it
        NotificationManagerCompat.from(context).cancel(1001)

        val prefs = context.getSharedPreferences("centiq_notif_data", Context.MODE_PRIVATE)

        if (action == "com.centiq.ACTION_WORTH_IT") {
            // Save flag: true means there is a pending label, false means it was "Worth It"
            prefs.edit().putBoolean("has_pending_label", true).putBoolean("pending_label_value", false).apply()
            showConfirmationNotification(context, "✅ Logged as Worth It!")

        } else if (action == "com.centiq.ACTION_IMPULSIVE") {
            // Save flag: true means there is a pending label, true means it was "Impulsive"
            prefs.edit().putBoolean("has_pending_label", true).putBoolean("pending_label_value", true).apply()
            showConfirmationNotification(context, "❤️‍🔥 Logged as Impulsive!")
        }
    }

    private fun showConfirmationNotification(context: Context, text: String) {
        val builder = NotificationCompat.Builder(context, "centiq_transactions")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)

        NotificationManagerCompat.from(context).notify(1002, builder.build())
    }
}