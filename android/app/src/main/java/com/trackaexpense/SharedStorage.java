package com.trackaexpense;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class SharedStorage extends ReactContextBaseJavaModule {

    public SharedStorage(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SharedStorage";
    }

    @ReactMethod
    public void set(String message) {
        try {
            SharedPreferences.Editor editor = getReactApplicationContext().getSharedPreferences("DATA", Context.MODE_PRIVATE).edit();
            editor.putString("widgetData", message);
            editor.apply();

            Intent intent = new Intent(getReactApplicationContext(), NewAppWidget.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            int[] ids = AppWidgetManager.getInstance(getReactApplicationContext()).getAppWidgetIds(new ComponentName(getReactApplicationContext(), NewAppWidget.class));
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            getReactApplicationContext().sendBroadcast(intent);
        } catch (Exception e) {
            Log.e("SharedStorage", "Error in set method: " + e.getMessage());
        }
    }
}
