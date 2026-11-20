const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function underThousand(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return o ? `${TENS[t]}-${ONES[o]}` : TENS[t]
  }
  const h = Math.floor(n / 100)
  const rest = n % 100
  return rest ? `${ONES[h]} Hundred ${underThousand(rest)}` : `${ONES[h]} Hundred`
}

function underMillion(n: number): string {
  if (n < 1000) return underThousand(n)
  const th = Math.floor(n / 1000)
  const rest = n % 1000
  const left = th < 1000 ? underThousand(th) : underMillion(th)
  return rest ? `${left} Thousand ${underThousand(rest)}` : `${left} Thousand`
}

/** Philippine-style peso amount in words, e.g. "One Thousand Two Hundred Pesos Only". */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return ''
  const pesos = Math.floor(amount)
  const centavos = Math.round((amount - pesos) * 100)
  if (pesos === 0 && centavos === 0) return 'Zero Pesos Only'

  let words = ''
  if (pesos >= 1_000_000) {
    const millions = Math.floor(pesos / 1_000_000)
    const rest = pesos % 1_000_000
    words = `${underMillion(millions)} Million`
    if (rest) words += ` ${underMillion(rest)}`
  } else if (pesos > 0) {
    words = underMillion(pesos)
  }

  if (pesos > 0) words += pesos === 1 ? ' Peso' : ' Pesos'
  if (centavos > 0) {
    const cWords = underThousand(centavos)
    words += pesos > 0 ? ` and ${cWords} Centavos` : `${cWords} Centavos`
  }
  return `${words} Only`
}
