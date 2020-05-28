import * as reactRedux from 'react-redux'
import assert from 'assert'
import { renderHook } from '@testing-library/react-hooks'
import sinon from 'sinon'
import transactions from '../../../../test/data/transaction-data.json'
import { useTransactionDisplayData } from '../useTransactionDisplayData'
import { tokenSelector, getPreferences, getShouldShowFiat, getNativeCurrency, getCurrentCurrency } from '../../selectors'
import * as i18nhooks from '../useI18nContext'
import { getMessage } from '../../helpers/utils/i18n-helper'
import messages from '../../../../app/_locales/en/messages.json'


const expectedResults = [
  { title: 'Send ETH',
    category: 'send',
    subtitle: 'To: 0xffe5...1a97',
    date: 'May 12',
    primaryCurrency: '-1 ETH',
    senderAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    recipientAddress: '0xffe5bc4e8f1f969934d773fa67da095d2e491a97',
    secondaryCurrency: '-1 ETH',
    isPending: false,
    status: 'confirmed' },
  { title: 'Send ETH',
    category: 'send',
    subtitle: 'To: 0x0ccc...8848',
    date: 'May 12',
    primaryCurrency: '-2 ETH',
    senderAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    recipientAddress: '0x0ccc8aeeaf5ce790f3b448325981a143fdef8848',
    secondaryCurrency: '-2 ETH',
    isPending: false,
    status: 'confirmed' },
  { title: 'Send ETH',
    category: 'send',
    subtitle: 'To: 0xffe5...1a97',
    date: 'May 12',
    primaryCurrency: '-2 ETH',
    senderAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    recipientAddress: '0xffe5bc4e8f1f969934d773fa67da095d2e491a97',
    secondaryCurrency: '-2 ETH',
    isPending: false,
    status: 'confirmed' },
  { title: 'Receive',
    category: 'receive',
    subtitle: 'From: 0x31b9...4523',
    date: 'May 12',
    primaryCurrency: '18.75 ETH',
    senderAddress: '0x31b98d14007bdee637298086988a0bbd31184523',
    recipientAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    secondaryCurrency: '18.75 ETH',
    isPending: false,
    status: 'confirmed' },
  { title: 'Receive',
    category: 'receive',
    subtitle: 'From: 0x9eca...a149',
    date: 'May 8',
    primaryCurrency: '0 ETH',
    senderAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    recipientAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    secondaryCurrency: '0 ETH',
    isPending: false,
    status: 'confirmed' },
  { title: 'Receive',
    category: 'receive',
    subtitle: 'From: 0xee01...febb',
    date: 'May 24',
    primaryCurrency: '1 ETH',
    senderAddress: '0xee014609ef9e09776ac5fe00bdbfef57bcdefebb',
    recipientAddress: '0x9eca64466f257793eaa52fcfff5066894b76a149',
    secondaryCurrency: '1 ETH',
    isPending: false,
    status: 'confirmed' },
]

let useSelector, useI18nContext

describe('useTransactionDisplayData', function () {
  before(function () {
    useSelector = sinon.stub(reactRedux, 'useSelector')
    useI18nContext = sinon.stub(i18nhooks, 'useI18nContext')
    useI18nContext.returns((key, variables) => getMessage('en', messages, key, variables))
    useSelector.callsFake((selector) => {
      if (selector === tokenSelector) {
        return []
      } else if (selector === getPreferences) {
        return {
          useNativeCurrencyAsPrimaryCurrency: true,
        }
      } else if (selector === getShouldShowFiat) {
        return false
      } else if (selector === getNativeCurrency) {
        return 'ETH'
      } else if (selector === getCurrentCurrency) {
        return 'ETH'
      } else {
        return null
      }
    })
  })
  transactions.forEach((transactionGroup, idx) => {
    describe(`when called with group containing primaryTransaction id ${transactionGroup.primaryTransaction.id}`, function () {
      const expected = expectedResults[idx]
      it(`should return a title of ${expected.title}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.title, expected.title)
      })
      it(`should return a subtitle of ${expected.subtitle}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.subtitle, expected.subtitle)
      })
      it(`should return a category of ${expected.category}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.category, expected.category)
      })
      it(`should return a primaryCurrency of ${expected.primaryCurrency}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.primaryCurrency, expected.primaryCurrency)
      })
      it(`should return a secondaryCurrency of ${expected.secondaryCurrency}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.secondaryCurrency, expected.secondaryCurrency)
      })
      it(`should return a status of ${expected.status}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.status, expected.status)
      })
      it(`should return a recipientAddress of ${expected.recipientAddress}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.recipientAddress, expected.recipientAddress)
      })
      it(`should return a senderAddress of ${expected.senderAddress}`, function () {
        const { result } = renderHook(() => useTransactionDisplayData(transactionGroup))
        assert.equal(result.current.senderAddress, expected.senderAddress)
      })
    })
  })
  it('should return an appropriate object', function () {
    const { result } = renderHook(() => useTransactionDisplayData(transactions[0]))
    assert.deepEqual(result.current, expectedResults[0])
  })
  after(function () {
    useSelector.restore()
    useI18nContext.restore()
  })
})