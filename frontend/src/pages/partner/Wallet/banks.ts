/** Banks offered in the "Add account" form. `code` is the first 4 letters of the bank's IFSC. */
export interface BankOption {
  name: string;
  code: string;
}

export const BANKS: BankOption[] = [
  { name: 'State Bank of India', code: 'SBIN' },
  { name: 'HDFC Bank', code: 'HDFC' },
  { name: 'ICICI Bank', code: 'ICIC' },
  { name: 'Axis Bank', code: 'UTIB' },
  { name: 'Kotak Mahindra Bank', code: 'KKBK' },
  { name: 'Punjab National Bank', code: 'PUNB' },
  { name: 'Bank of Baroda', code: 'BARB' },
  { name: 'Canara Bank', code: 'CNRB' },
  { name: 'Union Bank of India', code: 'UBIN' },
  { name: 'Bank of India', code: 'BKID' },
  { name: 'Indian Bank', code: 'IDIB' },
  { name: 'Central Bank of India', code: 'CBIN' },
  { name: 'Indian Overseas Bank', code: 'IOBA' },
  { name: 'UCO Bank', code: 'UCBA' },
  { name: 'Bank of Maharashtra', code: 'MAHB' },
  { name: 'Punjab & Sind Bank', code: 'PSIB' },
  { name: 'IDBI Bank', code: 'IBKL' },
  { name: 'Yes Bank', code: 'YESB' },
  { name: 'IndusInd Bank', code: 'INDB' },
  { name: 'IDFC FIRST Bank', code: 'IDFB' },
  { name: 'Federal Bank', code: 'FDRL' },
  { name: 'South Indian Bank', code: 'SIBL' },
  { name: 'Karnataka Bank', code: 'KARB' },
  { name: 'Karur Vysya Bank', code: 'KVBL' },
  { name: 'City Union Bank', code: 'CIUB' },
  { name: 'Tamilnad Mercantile Bank', code: 'TMBL' },
  { name: 'Bandhan Bank', code: 'BDBL' },
  { name: 'RBL Bank', code: 'RATN' },
  { name: 'AU Small Finance Bank', code: 'AUBL' },
  { name: 'Equitas Small Finance Bank', code: 'ESFB' },
  { name: 'Ujjivan Small Finance Bank', code: 'USFB' },
  { name: 'Jammu & Kashmir Bank', code: 'JAKA' },
  { name: 'DCB Bank', code: 'DCBL' },
  { name: 'Dhanlaxmi Bank', code: 'DLXB' },
  { name: 'Saraswat Co-operative Bank', code: 'SRCB' },
  { name: 'Andhra Pradesh Grameena Vikas Bank', code: 'APGV' },
  { name: 'Telangana Grameena Bank', code: 'TGBX' },
  { name: 'Andhra Pragathi Grameena Bank', code: 'APGB' },
  { name: 'Karnataka Gramin Bank', code: 'PKGB' },
  { name: 'India Post Payments Bank', code: 'IPOS' },
  { name: 'Paytm Payments Bank', code: 'PYTM' },
  { name: 'Airtel Payments Bank', code: 'AIRP' },
  { name: 'Standard Chartered Bank', code: 'SCBL' },
  { name: 'HSBC', code: 'HSBC' },
  { name: 'Citibank', code: 'CITI' },
  { name: 'DBS Bank India', code: 'DBSS' },
];

/**
 * Account-number lengths each bank issues, by IFSC bank code. A bank can list more than one when it changed
 * its format over the years (or after a merger). Banks that are not listed accept the general 9 to 18 digits.
 * These follow commonly published figures. If a bank rejects a real number, add its length here.
 */
const ACCOUNT_LENGTHS: Record<string, number[]> = {
  SBIN: [11, 17],
  HDFC: [12, 14],
  ICIC: [12],
  UTIB: [15],
  KKBK: [10, 14],
  PUNB: [16],
  BARB: [14],
  CNRB: [13],
  UBIN: [15],
  BKID: [15],
  IDIB: [9, 10, 11],
  CBIN: [10],
  IOBA: [15],
  UCBA: [14, 16],
  MAHB: [11],
  PSIB: [15],
  IBKL: [15],
  YESB: [15],
  INDB: [12],
  IDFB: [10],
  FDRL: [14],
  SIBL: [16],
  KARB: [16],
  KVBL: [16],
  CIUB: [15],
  TMBL: [15],
  BDBL: [14],
  RATN: [12],
  AUBL: [12],
};

export const accountLengths = (code: string): number[] | undefined => ACCOUNT_LENGTHS[code.toUpperCase()];

/** [11] -> "11", [12, 14] -> "12 or 14", [9, 10, 11] -> "9, 10 or 11" */
export const lengthText = (lengths: number[]): string =>
  lengths.length === 1 ? String(lengths[0]) : `${lengths.slice(0, -1).join(', ')} or ${lengths[lengths.length - 1]}`;

export const bankByCode = (code: string): BankOption | undefined => BANKS.find((b) => b.code === code.toUpperCase());

export interface IfscInfo {
  bank: string;
  branch: string;
  address: string;
  city: string;
  district: string;
  state: string;
}

export type IfscLookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; info: IfscInfo }
  | { status: 'notfound' }
  | { status: 'error' };

/**
 * Looks an IFSC up in the free public Razorpay IFSC directory.
 * 404 -> "notfound" (the code does not exist); any other failure -> "error" (offline, blocked), which must not stop the user.
 */
export async function lookupIfsc(ifsc: string, signal?: AbortSignal): Promise<IfscLookup> {
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`, { signal });
    if (res.status === 404) return { status: 'notfound' };
    if (!res.ok) return { status: 'error' };
    const d = (await res.json()) as Record<string, string>;
    return {
      status: 'ok',
      info: {
        bank: d.BANK ?? '',
        branch: d.BRANCH ?? '',
        address: d.ADDRESS ?? '',
        city: d.CITY ?? '',
        district: d.DISTRICT ?? '',
        state: d.STATE ?? '',
      },
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return { status: 'error' };
  }
}
