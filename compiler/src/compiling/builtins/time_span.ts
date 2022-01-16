export enum TimeUnits {
    NANOSECONDS = 'NANOSECONDS',
    MICROSECONDS = 'MICROSECONDS',
    MILLISECONDS = 'MILLISECONDS',
    SECONDS = 'SECONDS',
    MINUTES = 'MINUTES',
    HOURS = 'HOURS',
    DAYS = 'DAYS',
    WEEKS = 'WEEKS',

    NANOSECOND = 'NANOSECONDS',
    MICROSECOND = 'MICROSECONDS',
    MILLISECOND = 'MILLISECONDS',
    SECOND = 'SECONDS',
    MINUTE = 'MINUTES',
    HOUR = 'HOURS',
    DAY = 'DAYS',
    WEEK = 'WEEKS',

    NS = 'NANOSECONDS',
    US = 'MICROSECONDS',
    MS = 'MILLISECONDS',
    S = 'SECONDS',
    M = 'MINUTES',
    H = 'HOURS',
    D = 'DAYS',
    W = 'WEEKS',
}

const timeExpressionRegex: RegExp = /(\d+)\s*([a-z]+)/gim;

const keywordTable = {
    nanoseconds: 0.000001,
    nanosecond: 0.000001,
    ns: 0.000001,
    microseconds: 0.001,
    microsecond: 0.001,
    μs: 0.001,
    milliseconds: 1,
    millisecond: 1,
    ms: 1,
    seconds: 1000,
    second: 1000,
    s: 1000,
    minutes: 1000 * 60,
    minute: 1000 * 60,
    m: 1000 * 60,
    hours: 1000 * 60 * 60,
    hour: 1000 * 60 * 60,
    h: 1000 * 60 * 60,
    days: 1000 * 60 * 60 * 24,
    day: 1000 * 60 * 60 * 24,
    d: 1000 * 60 * 60 * 24,
    weeks: 1000 * 60 * 60 * 24 * 7,
    week: 1000 * 60 * 60 * 24 * 7,
    w: 1000 * 60 * 60 * 24 * 7,
};

export function timespan(expression: string, unit: TimeUnits = TimeUnits.MILLISECONDS): number {
    timeExpressionRegex.lastIndex = 0;
    let result: number = 0;
    let match: string[];
    while ((match = timeExpressionRegex.exec(expression)) !== null) {
        const multiplier = parseFloat(match[1]);
        const unit = keywordTable[match[2].toLowerCase()];
        if (!unit) {
            throw new Error(`Unknown unit: ${match[2]} in expression ${expression}`);
        } else {
            result += multiplier * unit;
        }
    }

    switch (unit) {
        case TimeUnits.WEEKS:
            result /= keywordTable.weeks;
            break;
        case TimeUnits.DAYS:
            result /= keywordTable.days;
            break;
        case TimeUnits.HOURS:
            result /= keywordTable.hours;
            break;
        case TimeUnits.MINUTES:
            result /= keywordTable.minutes;
            break;
        case TimeUnits.SECONDS:
            result /= keywordTable.seconds;
            break;
        case TimeUnits.MICROSECONDS:
            result *= 1000;
            break;
        case TimeUnits.NANOSECONDS:
            result *= 1000000;
            break;
    }

    return result;
}
