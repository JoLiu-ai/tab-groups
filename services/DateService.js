const padNumber = (value) => String(value).padStart(2, '0');

export default class DateService {
    static formatDateTime(timestamp) {
        if (!timestamp) {
            return '--';
        }
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = padNumber(date.getMonth() + 1);
        const day = padNumber(date.getDate());
        const hours = padNumber(date.getHours());
        const minutes = padNumber(date.getMinutes());
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
}
