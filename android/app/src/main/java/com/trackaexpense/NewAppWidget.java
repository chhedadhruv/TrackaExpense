package com.trackaexpense;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Implementation of App Widget functionality.
 */
public class NewAppWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager,
                                int appWidgetId) {

        try {
            // Retrieve user data from SharedGroupPreferences
            SharedPreferences sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE);
            String widgetDataString = sharedPref.getString("widgetData", "{\"balance\": 0, \"totalIncome\": 0, \"totalExpense\": 0}");
            JSONObject widgetData = new JSONObject(widgetDataString);

            // Update the app widget UI
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.new_app_widget);

            // Replace 'balanceTextView', 'totalIncomeTextView', and 'totalExpenseTextView'
            // with the actual IDs of the TextViews in your R.layout.new_app_widget layout file.
            views.setTextViewText(R.id.appwidget_text, "Balance: " + widgetData.getDouble("balance"));
            views.setTextViewText(R.id.appwidget_text2, "Total Income: " + widgetData.getDouble("totalIncome"));
            views.setTextViewText(R.id.appwidget_text3, "Total Expense: " + widgetData.getDouble("totalExpense"));

            // Update the app widget
            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // There may be multiple widgets active, so update all of them
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onEnabled(Context context) {
        // Enter relevant functionality for when the first widget is created
    }

    @Override
    public void onDisabled(Context context) {
        // Enter relevant functionality for when the last widget is disabled
    }
}
