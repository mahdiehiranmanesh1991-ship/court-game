# راهنمای نوشتن پرونده — «اعتراض دارم!»

هر پرونده یک فایل جاوااسکریپت در `cases/` است که یک شیء ساده (فقط داده، بدون کد) را `export default` می‌کند.
موتور بازی (`js/engine.js`) همه‌ی قواعد را اجرا می‌کند و `validateCase()` قبل از هر انتشار، ایرادهای ساختاری را پیدا می‌کند.

## گام‌ها
1. یکی از پرونده‌های موجود را کپی کنید (`cases/cheque.js` ساده‌ترین است).
2. در `cases/index.js` آن را import کنید و به آرایه‌ی `CASES` اضافه کنید.
3. مسیر فایل را به فهرست `ASSETS` در `sw.js` اضافه کنید و `VERSION` را یک شماره بالا ببرید (وگرنه نسخه‌ی آفلاین قدیمی می‌ماند).
4. `npm test` را اجرا کنید. آزمون‌ها خودکار بررسی می‌کنند که پرونده معتبر است، با بازی بی‌نقص تا رأی قابل حل است، هر مدرک غلط قلب کم می‌کند و همه‌ی چهره‌ها رسم می‌شوند.

## ساختار سطح بالا
| فیلد | توضیح |
|---|---|
| `id` | شناسه‌ی یکتا، لاتین (کلید ذخیره‌ی پیشرفت) |
| `order` | ترتیب در فهرست پرونده‌ها (یکتا) |
| `title`, `subtitle` | عنوان و زیرعنوان |
| `court` | شعبه‌ی **خیالی** در کرمان؛ باید «کرمان» و «(خیالی)» داشته باشد |
| `difficulty` | ۱ تا ۳ |
| `tags`, `color` | برچسب‌ها و رنگ کارت |
| `cast` | شخصیت‌ها: `{ key: { name, role, look } }`. کلیدهای `judge` و `opp` در دادگاه پشت میز قاضی/دادستان نشان داده می‌شوند. `player` (وکیل) و `narr` (راوی) رزروشده‌اند |
| `evidence` | `[{ id, icon, name, desc, initial? }]` — `initial: true` یعنی از اول در پرونده است |
| `intro` | خطوط گفت‌وگوی شروع |
| `investigation` | تحقیق (پایین) |
| `trial` | بخش‌های دادگاه به ترتیب (پایین) |
| `verdict` | `{ title, lines }` — مثلاً «برائت» |
| `lesson` | کارت «نکته‌ی حقوقی»: `{ title, summary, points: [{ ref, text }] }` — دست‌کم ۳ نکته با «ماده/اصل» |

## خط گفت‌وگو
هر خط یک آرایه است: `['who', 'متن', 'mood', 'fx']`
- `who`: کلید `cast`، یا `player` یا `narr`.
- `mood`: `normal | happy | angry | shocked | sad | think | smug | sweat | confident`
- `fx` (اختیاری، با فاصله جدا): `gavel` (چکش)، `shake` (لرزش صفحه)، `flash`، `music:<court|cross|investigation|tension|victory>`، `evidence:<id>` (نمایش نام مدرک).
- `{name}` با نام خانوادگی بازیکن (از تنظیمات) جایگزین می‌شود: «خانم {name}».

## ظاهر شخصیت (`look`)
`{ kind, skin, hair, style, beard, beardColor, glasses, outfit, tie, scarf }`
- `kind`: `suit | judge | worker | uniform | manto`
- `style`: `maghnaeh | scarf | bald | slick | messy | spiky | side | cap | gray | short`
- `beard`: `none | full | short | mustache | stubble`
همه‌ی چهره‌ها SVG ساخته‌شده با کد در `js/art.js` هستند (هیچ تصویر بیرونی).

## تحقیق
```js
investigation: {
  start: 'office',                 // محل شروع
  required: ['contract', 'sms'],  // مدارک لازم برای فعال‌شدن «رفتن به دادگاه»
  ready: [ ...lines ],            // وقتی همه پیدا شد
  locations: [{ id, name, bg, icon, people: ['client'], actions: [
    { id, type: 'talk'|'examine', label, lines, again?, gives?: 'evidenceId', requires?: ['actionId' | 'evidenceId'] },
  ] }],
}
```
- `bg`: `court | office | workshop | bank | garden | station | shop | bazaar`
- `requires` اقدام را تا انجام اقدام/یافتن مدرک دیگر قفل می‌کند. اعتبارسنج بررسی می‌کند که هر مدرک لازم واقعاً قابل دستیابی باشد.
- شناسه‌ی اقدام‌ها در کل بازی یکتا باشد (پیشنهاد: پیشوند `c4_`).

## بخش‌های دادگاه (`trial`)
**صحنه:** `{ type: 'scene', id, lines }`

**شهادت + بازجویی متقابل:**
```js
{ type: 'testimony', id: 't1', witness: 'hamid', title: 'روز تحویل چک', hint: '…', solve: [...lines],
  statements: [
    { id: 's1', text: '…', press: [...lines] },
    { id: 's2', text: '…', press: [...], reveals: 's4' },        // فشار، جمله‌ی پنهان را آشکار می‌کند
    { id: 's3', text: '…', contradiction: ['contract', 'sms'] }, // یک یا چند مدرک درست
    { id: 's4', text: '…', hidden: true, contradiction: 'wood', wrong: [...] },
  ] }
```
- دست‌کم ۲ جمله و ۲ شهادت از ۲ شاهد متفاوت در هر پرونده.
- ارائه‌ی مدرک غلط = یک قلب کم (از ۵). `wrong` اختیاری است.

**ارائه‌ی مدرک به پرسش قاضی:** `{ type: 'present', id, lines?, prompt, hint, answer: 'id' | ['id', ...], success, fail? }`

**گزینه‌ای:** `{ type: 'choice', id, lines?, prompt, hint, options: [{ text, correct?: true, lines? }], success }` — دقیقاً یک گزینه‌ی درست.

## امتیاز
- امتیاز = ۱۰۰۰ + ۲۰۰×قلب − ۷۵×راهنما − ۵۰×اشتباه − ۳۰۰×تلاش دوباره (حداقل صفر).
- ستاره: ۳ = پنج قلب و بدون راهنما؛ ۲ = دست‌کم سه قلب؛ ۱ = بقیه (هر «تلاش دوباره» سقف را ۱ می‌کند).

## اصول محتوا
- نام‌ها، شعبه‌ها و رویدادها **خیالی**؛ مواد قانونی **واقعی** و با شماره‌ی ماده.
- متن ماده را خلاصه و دقیق بنویسید و از منبع رسمی (سامانه‌ی ملی قوانین، lawlex.ir و …) چک کنید. از ذکر عدد مجازات‌هایی که ممکن است اصلاح شده باشد پرهیز کنید.
- هیچ نام، شخصیت یا تصویر از بازی‌های تجاری دیگر استفاده نکنید (آزمون این را هم بررسی می‌کند).
