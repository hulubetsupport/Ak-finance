# Ak Finance · Business Payment Desk (mrkuz)

Android application designed to replace MacroDroid for Ethiopian businesses. Automatically captures bank SMS notifications (CBE, Telebirr, Awash, Dashen, BoA), parses transaction details with AI pattern recognition, saves to a persistent local SQLite offline queue, and syncs immediately to your Render backend server.

---

## 🇪🇹 የአንድሮይድ ጭነት እና አጠቃቀም መመሪያ (Amharic Quick Start)

### 1. የ APK ፋይል በ GitHub Actions ማመንጨት
1. ይህንን ሙሉ ኮድ ወደ GitHub Repo ይጫኑ (Push ያድርጉ)።
2. GitHub ላይ **Actions** ታብ ይክፈቱ።
3. `Build Ak Finance Android APK` በራሱ ተጀምሮ ሲያልቅ በ **Artifacts** ስር `ak-finance-debug-apk` የሚለውን ወርደው በስልክዎ ላይ ይጫኑት።

### 2. አንድሮይድ 13 እና ከዚያ በላይ (Android 13+ Restricted Settings)
መተግበሪያውን ከጫኑ በኋላ የባንክ SMS እንዳያመልጠው የሚከተለውን ያድርጉ፡
1. **ስልክ ቅንብር (Settings) → Apps → Ak Finance** ይክፈቱ።
2. ከላይ በቀኝ በኩል ያለውን **3 ነጥብ (⋮)** ይጫኑ → **"Allow restricted settings"** የሚለውን ያብሩ።
3. ወደ ኋላ ተመልሰው **Permissions** ውስጥ **SMS** እና **Notifications** ፈቃድ ይስጡ።
4. **App Info → Battery** ገብተው **"Unrestricted"** ይምረጡ (ስልኩ እንዳያጠፋው)።

### 3. የሰርቨር ማስተካከያ (Settings)
- በመተግበሪያው ውስጥ **Settings** ገብተው የ Render ሰርቨርዎን URL ያስገቡ።
- **Secret Key**ዎን ያስገቡ።
- **Server Mode** ከመረጡ መልዕክት ሲደርስ ወዲያውኑ ወደ ሰርቨርዎ ይላካል፤ ኢንተርኔት ባይኖር እንኳ በስልክዎ SQLite ውስጥ ተቀምጦ ኢንተርኔት ሲመጣ በራሱ ይላካል።
- **Local Mode** ከመረጡ በስልክዎ ብቻ ተመዝግቦ ይቀመጣል።

---

## 🏛 Supported Financial Channels
- **CBE (Commercial Bank of Ethiopia)**: Senders `CBE`, `127`, `889`
- **Telebirr (Ethio Telecom)**: Senders `Telebirr`, `127`
- **Awash Bank**: Senders `AwashBank`, `Awash`
- **Dashen Bank**: Senders `Dashen`
- **Bank of Abyssinia (BoA)**, **Coop Bank**, **Hibret Bank**
- Custom sender whitelist configurable in Settings.

---

## 🔄 Webhook API Contract (Render Server)
When an SMS arrives, Ak Finance dispatches an HTTP POST/GET request:

```json
{
  "action": "save_sms",
  "token": "YOUR_SECRET_KEY",
  "sender": "CBE",
  "message": "Dear Customer, your account 1000****4819 has been credited with ETB 8,400.00...",
  "bank": "CBE",
  "type": "received",
  "amount": 8400.00,
  "currency": "ETB",
  "counterparty": "Tadesse Girma",
  "reference": "FT2629391038",
  "balance": 142500.20,
  "timestamp": 1729608794000
}
```
- **HTTP 200 OK Response**: Marks the record as `synced`.
- **Network drop or non-200**: Kept in local SQLite queue and retried every `N` seconds automatically.

---

## 🏗 Local Development & Build Commands
```bash
# Install dependencies
npm install

# Run web app preview with live SMS simulator
npm run dev

# Build web distribution for Capacitor
npm run build

# Sync with Android project
npx cap sync android
```
