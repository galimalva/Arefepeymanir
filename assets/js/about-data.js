import { escapeHtml, toPersianDigits } from './utils.js';

export const PENDING = 'در حال تکمیل — پس از تکمیل اطلاعات توسط نویسنده نمایش داده می‌شود.';

export function setHtml(id, html) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = html;
}

export function emptyNote() {
  return `<p class="section-empty">${escapeHtml(PENDING)}</p>`;
}

export function timelineHtml(items, category) {
  return (
    '<ul class="timeline">' +
    items
      .map(
        (item) => `
      <li class="timeline-item" data-category="${escapeHtml(category)}">
        ${item.period ? `<span class="timeline-period">${escapeHtml(item.period)}</span>` : ''}
        <h3 class="timeline-title">${escapeHtml(item.title)}</h3>
        ${item.description ? `<p class="timeline-desc">${escapeHtml(item.description)}</p>` : ''}
      </li>`
      )
      .join('') +
    '</ul>'
  );
}

export function awardHtml(items) {
  if (!items.length) return emptyNote();
  return (
    '<ul class="awards-list">' +
    items
      .map(
        (award) => `
      <li class="award-item">
        ${award.year ? `<span class="badge badge--outline award-year">${toPersianDigits(award.year)}</span>` : ''}
        <div class="award-text">
          <h3 class="award-title">${escapeHtml(award.title)}</h3>
          ${award.description ? `<p class="award-desc">${escapeHtml(award.description)}</p>` : ''}
        </div>
      </li>`
      )
      .join('') +
    '</ul>'
  );
}

export const CATEGORY_SECTIONS = [
  { key: 'literary', id: 'timeline-literary-body' },
  { key: 'artistic', id: 'timeline-artistic-body' },
  { key: 'education', id: 'timeline-education-body' },
  { key: 'teaching', id: 'timeline-teaching-body' },
  { key: 'career', id: 'timeline-career-body' },
  { key: 'specialty', id: 'timeline-specialty-body' },
  { key: 'mentor', id: 'timeline-mentor-body' }
];

export const RESUME_SECTIONS = [
  { key: 'literary', id: 'resume-literary-body' },
  { key: 'artistic', id: 'resume-artistic-body' },
  { key: 'education', id: 'resume-education-body' },
  { key: 'teaching', id: 'resume-teaching-body' },
  { key: 'career', id: 'resume-career-body' },
  { key: 'specialty', id: 'resume-specialty-body' },
  { key: 'mentor', id: 'resume-mentor-body' }
];

export const FALLBACK_TIMELINE = [
  { category: 'literary', title: 'کتاب‌آرایی داستان‌های مولانا', period: 'برگزیدهٔ ۱۳۹۵', description: 'کتاب Rumi\'s Stories — انتشارات بانگ نی؛ ترجمه به زبان انگلیسی.' },
  { category: 'artistic', title: 'شروع فعالیت هنری', period: '۱۳۷۴', description: null },
  { category: 'artistic', title: 'بیش از ۵۰ نمایشگاه گروهی', period: null, description: null },
  { category: 'artistic', title: 'سه نمایشگاه انفرادی داخلی و خارجی', period: null, description: null },
  { category: 'artistic', title: 'نمایشگاه و ورکشاپ در سفارت تونس و دانشگاه قرطاج', period: null, description: 'به دعوت سفیر.' },
  { category: 'artistic', title: 'حضور در نمایشگاه‌های بین‌المللی', period: null, description: 'کانادا، لاهور، کابل، تونس و اسپانیا.' },
  { category: 'artistic', title: 'شرکت در جشنواره فجر و هشتمین دوسالانه نگارگری', period: null, description: 'چاپ ۴ اثر در کتاب مربوط به دوسالانه.' },
  { category: 'education', title: 'کارشناسی مدیریت', period: null, description: null },
  { category: 'education', title: 'کارشناسی ارشد هنر اسلامی', period: null, description: 'دانشگاه فردوسی مشهد.' },
  { category: 'education', title: 'مدرک ممتاز از مؤسسه توسعه هنرهای تجسمی تهران', period: null, description: 'در رشته‌های تذهیب، گل و مرغ و مینیاتور.' },
  { category: 'education', title: 'گواهینامه مربی‌گری و مدیریت', period: null, description: 'سازمان فنی و حرفه‌ای.' },
  { category: 'teaching', title: 'مدرس نقاشی ایرانی دانشگاه آزاد', period: null, description: null },
  { category: 'teaching', title: 'تدریس مینیاتور و نقاشی مدرن', period: 'از ۱۳۸۹', description: null },
  { category: 'teaching', title: 'مدرس کلاس‌های تخصصی هنر مجتمع امام رضا (ع)', period: '۱۳۹۳–۱۳۹۸', description: 'همراه با داوری آثار.' },
  { category: 'teaching', title: 'آسیستان کلاس‌های تخصصی هنر مجتمع امام رضا (ع)', period: null, description: null },
  { category: 'teaching', title: 'دریافت اجازه تدریس', period: '۱۳۹۸', description: 'از مدیر گروه هنر دانشگاه تربیت مدرس تهران و استاد اسکندرپور خرمی.' },
  { category: 'career', title: 'عضو انجمن تذهیب‌کاران رضوان', period: null, description: null },
  { category: 'career', title: 'عضو صنایع دستی و میراث فرهنگی', period: null, description: null },
  { category: 'career', title: 'عضو هیئت مؤسس کانون نگارگران زرافشان', period: 'از ۱۳۸۹', description: null },
  { category: 'career', title: 'ریاست کانون نگارگران زرافشان', period: 'از ۱۴۰۱', description: null },
  { category: 'career', title: 'حکم پیشکسوتی', period: 'از ۱۴۰۰', description: null },
  { category: 'specialty', title: 'تذهیب', period: null, description: null },
  { category: 'specialty', title: 'گل و مرغ', period: null, description: null },
  { category: 'specialty', title: 'مینیاتور', period: null, description: null },
  { category: 'specialty', title: 'نقاشی مدرن', period: null, description: null },
  { category: 'mentor', title: 'مهین افشان‌پور', period: null, description: null },
  { category: 'mentor', title: 'گیلدا احسان', period: null, description: null },
  { category: 'mentor', title: 'استاد خانم جنگی', period: null, description: null },
  { category: 'mentor', title: 'احسان افشار', period: null, description: null },
  { category: 'mentor', title: 'اسکندرپور خرمی', period: null, description: null },
  { category: 'mentor', title: 'مهدوی', period: null, description: null },
  { category: 'mentor', title: 'قزی', period: null, description: null },
  { category: 'mentor', title: 'بهدانی', period: null, description: null }
];

export const FALLBACK_AWARDS = [
  { title: 'لوح تقدیر از ارشاد خراسان رضوی', year: null, description: null },
  { title: 'تقدیرنامه از مجتمع امام رضا (ع)', year: null, description: null },
  { title: 'تقدیرنامه نهمین جشنواره هنرهای تجسمی جوانان مشهد', year: null, description: 'با سمت مسئول کارگاه نگارگری.' },
  { title: 'تقدیرنامه سومین نمایشگاه کاروان آفتاب', year: null, description: null },
  { title: 'لوح سپاس از مؤسسه آفرینش‌های آستان قدس', year: null, description: null },
  { title: 'لوح تقدیر بیمارستان جوادالائمه', year: null, description: 'اجرای ۴۰ تابلو نقاشی مدرن و نمایشگاه دائم در بیمارستان.' },
  { title: 'لوح تقدیر جشنواره حضرت علی‌اصغر', year: null, description: null },
  { title: 'لوح برگزیده اولین جشنواره تذهیب‌های قرآنی', year: null, description: null },
  { title: 'رتبه سوم نمایشگاه خیمه عاشورائیان و لوح تقدیر دانشگاه تربیت مدرس', year: 1391, description: 'آذر ماه ۱۳۹۱.' }
];