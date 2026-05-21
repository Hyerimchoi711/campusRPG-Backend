'use strict';

class KstDateService {
  /** @param {Date} [d] */
  kstYmd(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /** KST 달력 기준 해당 주의 월요일 YYYY-MM-DD */
  kstMondayYmd(todayYmd) {
    const d = new Date(`${todayYmd}T12:00:00+09:00`);
    const dow = d.getUTCDay();
    const offset = (dow + 6) % 7;
    const monMs = d.getTime() - offset * 86400000;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(monMs));
  }
}

const kstDateService = new KstDateService();

module.exports = {
  KstDateService,
  kstDateService,
  kstYmd: kstDateService.kstYmd.bind(kstDateService),
  kstMondayYmd: kstDateService.kstMondayYmd.bind(kstDateService),
};
