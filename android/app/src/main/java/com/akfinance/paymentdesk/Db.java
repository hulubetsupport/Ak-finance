package com.akfinance.paymentdesk;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class Db extends SQLiteOpenHelper {
    private static Db instance;

    public static synchronized Db get(Context c) {
        if (instance == null) {
            instance = new Db(c.getApplicationContext());
        }
        return instance;
    }

    Db(Context c) {
        super(c, "ejeta.db", null, 1);
    }

    @Override
    public void onCreate(SQLiteDatabase d) {
        d.execSQL("CREATE TABLE sms(id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, body TEXT, ts INTEGER, status TEXT, tries INTEGER DEFAULT 0, err TEXT, code INTEGER DEFAULT 0)");
        d.execSQL("CREATE TABLE withdrawals(id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL, ts INTEGER, note TEXT)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase d, int oldVersion, int newVersion) {
        // Upgrade logic if needed in future versions
    }
}
