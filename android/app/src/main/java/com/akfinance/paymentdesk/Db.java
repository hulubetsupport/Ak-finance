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
        super(c, "ejeta.db", null, 2);
    }

    @Override
    public void onCreate(SQLiteDatabase d) {
        d.execSQL("CREATE TABLE sms(id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, body TEXT, ts INTEGER, status TEXT, tries INTEGER DEFAULT 0, err TEXT, code INTEGER DEFAULT 0)");
        d.execSQL("CREATE TABLE withdrawals(id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL, ts INTEGER, note TEXT)");
        d.execSQL("CREATE TABLE IF NOT EXISTS opening_balances(bank TEXT PRIMARY KEY, amount REAL, updated_at INTEGER)");
        d.execSQL("CREATE TABLE IF NOT EXISTS sms_overrides(sms_id INTEGER PRIMARY KEY, counterparty TEXT, direction TEXT, note TEXT, is_hidden INTEGER DEFAULT 0, updated_at INTEGER)");
        d.execSQL("CREATE TABLE IF NOT EXISTS sender_bank_map(sender TEXT PRIMARY KEY, bank_name TEXT)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase d, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            d.execSQL("CREATE TABLE IF NOT EXISTS opening_balances(bank TEXT PRIMARY KEY, amount REAL, updated_at INTEGER)");
            d.execSQL("CREATE TABLE IF NOT EXISTS sms_overrides(sms_id INTEGER PRIMARY KEY, counterparty TEXT, direction TEXT, note TEXT, is_hidden INTEGER DEFAULT 0, updated_at INTEGER)");
            d.execSQL("CREATE TABLE IF NOT EXISTS sender_bank_map(sender TEXT PRIMARY KEY, bank_name TEXT)");
        }
    }
}
