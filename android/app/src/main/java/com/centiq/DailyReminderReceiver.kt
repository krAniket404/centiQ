package com.centiq

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class DailyReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "Q Reminder"
        val message = intent.getStringExtra("message") ?: "Check your spending today."

        val channelId = "centiq_reminders"

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                channelId,
                "Q Daily Reminders",
                android.app.NotificationManager.IMPORTANCE_HIGH // Changed to HIGH so it pops down
            ).apply {
                description = "Daily behavioral check-ins and streak warnings"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 100, 50, 100) // Premium double vibration
            }
            val notificationManager: android.app.NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.createNotificationChannel(channel)
        }

        val builder = NotificationCompat.Builder(context, channelId)
            // Uses a much nicer built-in bell/alarm icon instead of the ugly warning sign
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            // Adds your Q blue accent color to the icon and app name
            .setColor(0xFF38BDF8.toInt())
            .setColorized(true)
            // Makes it slide down from the top of the screen
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)

        try {
            // Use ID 2001 so it doesn't conflict with the SMS notifications (1001)
            NotificationManagerCompat.from(context).notify(2001, builder.build())
        } catch (e: SecurityException) {
            // Handle missing permission gracefully
        }
    }
}