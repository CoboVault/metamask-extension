import assert from 'assert'
import sinon from 'sinon'

import { ethers } from 'ethers'
import { mapValues } from 'lodash'
import BigNumber from 'bignumber.js'
import ObservableStore from 'obs-store'
import {
  ROPSTEN_NETWORK_ID,
  MAINNET_NETWORK_ID,
} from '../../../../app/scripts/controllers/network/enums'
import { ETH_SWAPS_TOKEN_ADDRESS } from '../../../../ui/app/helpers/constants/swaps'
import { createTestProviderTools } from '../../../stub/provider'
import SwapsController, {
  utils,
  SWAPS_LIVELINESS_CHECK_INTERVAL,
} from '../../../../app/scripts/controllers/swaps'

const MOCK_FETCH_PARAMS = {
  slippage: 3,
  sourceToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
  sourceDecimals: 18,
  destinationToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  value: '1000000000000000000',
  fromAddress: '0x7F18BB4Dd92CF2404C54CBa1A9BE4A1153bdb078',
  exchangeList: 'zeroExV1',
}

const TEST_AGG_ID_1 = 'TEST_AGG_1'
const TEST_AGG_ID_2 = 'TEST_AGG_2'
const TEST_AGG_ID_3 = 'TEST_AGG_3'
const TEST_AGG_ID_4 = 'TEST_AGG_4'
const TEST_AGG_ID_5 = 'TEST_AGG_5'
const TEST_AGG_ID_6 = 'TEST_AGG_6'
const TEST_AGG_ID_BEST = 'TEST_AGG_BEST'
const TEST_AGG_ID_APPROVAL = 'TEST_AGG_APPROVAL'

const MOCK_APPROVAL_NEEDED = {
  data:
    '0x095ea7b300000000000000000000000095e6f48254609a6ee006f7d493c8e5fb97094cef0000000000000000000000000000000000000000004a817c7ffffffdabf41c00',
  to: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  amount: '0',
  from: '0x2369267687A84ac7B494daE2f1542C40E37f4455',
  gas: '12',
  gasPrice: '34',
}

const MOCK_QUOTES_APPROVAL_REQUIRED = {
  [TEST_AGG_ID_APPROVAL]: {
    trade: {
      data: '0x00',
      from: '0x7F18BB4Dd92CF2404C54CBa1A9BE4A1153bdb078',
      value: '0x17647444f166000',
      gas: '0xe09c0',
      gasPrice: undefined,
      to: '0x881d40237659c251811cec9c364ef91dc08d300c',
    },
    sourceAmount: '1000000000000000000000000000000000000',
    destinationAmount: '396493201125465',
    error: null,
    sourceToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    destinationToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    maxGas: 920000,
    averageGas: 312510,
    estimatedRefund: 343090,
    fetchTime: 559,
    aggregator: TEST_AGG_ID_APPROVAL,
    aggType: 'AGG',
    slippage: 3,
    approvalNeeded: MOCK_APPROVAL_NEEDED,
    fee: 1,
  },
}

const MOCK_FETCH_METADATA = {
  destinationTokenInfo: {
    symbol: 'FOO',
    decimals: 18,
  },
}

const MOCK_TOKEN_RATES_STORE = new ObservableStore({
  contractExchangeRates: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 2,
    '0x1111111111111111111111111111111111111111': 0.1,
  },
})

const MOCK_GET_PROVIDER_CONFIG = () => ({ type: 'FAKE_NETWORK' })

const MOCK_GET_BUFFERED_GAS_LIMIT = async () => ({
  gasLimit: 2000000,
  simulationFails: undefined,
})

function getMockNetworkController() {
  return {
    store: {
      getState: () => {
        return {
          network: ROPSTEN_NETWORK_ID,
        }
      },
    },
    on: sinon.stub().withArgs('networkDidChange').callsArgAsync(1),
  }
}

const EMPTY_INIT_STATE = {
  swapsState: {
    quotes: {},
    fetchParams: null,
    tokens: null,
    tradeTxId: null,
    approveTxId: null,
    quotesLastFetched: null,
    customMaxGas: '',
    customGasPrice: null,
    selectedAggId: null,
    customApproveTxData: '',
    errorKey: '',
    topAggId: null,
    routeState: '',
    swapsFeatureIsLive: false,
  },
}

const sandbox = sinon.createSandbox()
const fetchTradesInfoStub = sandbox.stub()
const fetchSwapsFeatureLivenessStub = sandbox.stub()

describe('SwapsController', function () {
  let provider

  const getSwapsController = () => {
    return new SwapsController({
      getBufferedGasLimit: MOCK_GET_BUFFERED_GAS_LIMIT,
      networkController: getMockNetworkController(),
      provider,
      getProviderConfig: MOCK_GET_PROVIDER_CONFIG,
      tokenRatesStore: MOCK_TOKEN_RATES_STORE,
      fetchTradesInfo: fetchTradesInfoStub,
      fetchSwapsFeatureLiveness: fetchSwapsFeatureLivenessStub,
    })
  }

  before(function () {
    const providerResultStub = {
      // 1 gwei
      eth_gasPrice: '0x0de0b6b3a7640000',
      // by default, all accounts are external accounts (not contracts)
      eth_getCode: '0x',
    }
    provider = createTestProviderTools({
      scaffold: providerResultStub,
      networkId: 1,
      chainId: 1,
    }).provider
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('constructor', function () {
    it('should setup correctly', function () {
      const swapsController = getSwapsController()
      assert.deepStrictEqual(swapsController.store.getState(), EMPTY_INIT_STATE)
      assert.deepStrictEqual(
        swapsController.getBufferedGasLimit,
        MOCK_GET_BUFFERED_GAS_LIMIT,
      )
      assert.strictEqual(swapsController.pollCount, 0)
      assert.deepStrictEqual(
        swapsController.getProviderConfig,
        MOCK_GET_PROVIDER_CONFIG,
      )
    })

    it('should replace ethers instance when network changes', function () {
      const networkController = getMockNetworkController()
      const swapsController = new SwapsController({
        getBufferedGasLimit: MOCK_GET_BUFFERED_GAS_LIMIT,
        networkController,
        provider,
        getProviderConfig: MOCK_GET_PROVIDER_CONFIG,
        tokenRatesStore: MOCK_TOKEN_RATES_STORE,
        fetchTradesInfo: fetchTradesInfoStub,
        fetchSwapsFeatureLiveness: fetchSwapsFeatureLivenessStub,
      })
      const currentEthersInstance = swapsController.ethersProvider
      const onNetworkDidChange = networkController.on.getCall(0).args[1]

      onNetworkDidChange(MAINNET_NETWORK_ID)

      const newEthersInstance = swapsController.ethersProvider
      assert.notStrictEqual(
        currentEthersInstance,
        newEthersInstance,
        'Ethers provider should be replaced',
      )
    })

    it('should not replace ethers instance when network changes to loading', function () {
      const networkController = getMockNetworkController()
      const swapsController = new SwapsController({
        getBufferedGasLimit: MOCK_GET_BUFFERED_GAS_LIMIT,
        networkController,
        provider,
        getProviderConfig: MOCK_GET_PROVIDER_CONFIG,
        tokenRatesStore: MOCK_TOKEN_RATES_STORE,
        fetchTradesInfo: fetchTradesInfoStub,
        fetchSwapsFeatureLiveness: fetchSwapsFeatureLivenessStub,
      })
      const currentEthersInstance = swapsController.ethersProvider
      const onNetworkDidChange = networkController.on.getCall(0).args[1]

      onNetworkDidChange('loading')

      const newEthersInstance = swapsController.ethersProvider
      assert.strictEqual(
        currentEthersInstance,
        newEthersInstance,
        'Ethers provider should not be replaced',
      )
    })

    it('should not replace ethers instance when network changes to the same network', function () {
      const networkController = getMockNetworkController()
      const swapsController = new SwapsController({
        getBufferedGasLimit: MOCK_GET_BUFFERED_GAS_LIMIT,
        networkController,
        provider,
        getProviderConfig: MOCK_GET_PROVIDER_CONFIG,
        tokenRatesStore: MOCK_TOKEN_RATES_STORE,
        fetchTradesInfo: fetchTradesInfoStub,
        fetchSwapsFeatureLiveness: fetchSwapsFeatureLivenessStub,
      })
      const currentEthersInstance = swapsController.ethersProvider
      const onNetworkDidChange = networkController.on.getCall(0).args[1]

      onNetworkDidChange(ROPSTEN_NETWORK_ID)

      const newEthersInstance = swapsController.ethersProvider
      assert.strictEqual(
        currentEthersInstance,
        newEthersInstance,
        'Ethers provider should not be replaced',
      )
    })
  })

  describe('API', function () {
    let swapsController
    beforeEach(function () {
      swapsController = getSwapsController()
    })

    describe('setters', function () {
      it('should set selected quote agg id', function () {
        const selectedAggId = 'test'
        swapsController.setSelectedQuoteAggId(selectedAggId)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.selectedAggId,
          selectedAggId,
        )
      })

      it('should set swaps tokens', function () {
        const tokens = []
        swapsController.setSwapsTokens(tokens)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.tokens,
          tokens,
        )
      })

      it('should set trade tx id', function () {
        const tradeTxId = 'test'
        swapsController.setTradeTxId(tradeTxId)
        assert.strictEqual(
          swapsController.store.getState().swapsState.tradeTxId,
          tradeTxId,
        )
      })

      it('should set swaps tx gas price', function () {
        const gasPrice = 1
        swapsController.setSwapsTxGasPrice(gasPrice)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.customGasPrice,
          gasPrice,
        )
      })

      it('should set swaps tx gas limit', function () {
        const gasLimit = '1'
        swapsController.setSwapsTxGasLimit(gasLimit)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.customMaxGas,
          gasLimit,
        )
      })

      it('should set background swap route state', function () {
        const routeState = 'test'
        swapsController.setBackgroundSwapRouteState(routeState)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.routeState,
          routeState,
        )
      })

      it('should set swaps error key', function () {
        const errorKey = 'test'
        swapsController.setSwapsErrorKey(errorKey)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.errorKey,
          errorKey,
        )
      })

      it('should set initial gas estimate', async function () {
        const initialAggId = TEST_AGG_ID_1
        const baseGasEstimate = 10
        const { maxGas, estimatedRefund } = getMockQuotes()[TEST_AGG_ID_1]

        const { swapsState } = swapsController.store.getState()
        // Set mock quotes in order to have data for the test agg
        swapsController.store.updateState({
          swapsState: { ...swapsState, quotes: getMockQuotes() },
        })

        await swapsController.setInitialGasEstimate(
          initialAggId,
          baseGasEstimate,
        )

        const {
          gasLimit: bufferedGasLimit,
        } = await swapsController.getBufferedGasLimit()
        const {
          gasEstimate,
          gasEstimateWithRefund,
        } = swapsController.store.getState().swapsState.quotes[initialAggId]
        assert.strictEqual(gasEstimate, bufferedGasLimit)
        assert.strictEqual(
          gasEstimateWithRefund,
          new BigNumber(maxGas, 10).minus(estimatedRefund, 10).toString(16),
        )
      })

      it('should set custom approve tx data', function () {
        const data = 'test'
        swapsController.setCustomApproveTxData(data)
        assert.deepStrictEqual(
          swapsController.store.getState().swapsState.customApproveTxData,
          data,
        )
      })
    })

    describe('_findTopQuoteAndCalculateSavings', function () {
      beforeEach(function () {
        const { swapsState } = swapsController.store.getState()
        swapsController.store.updateState({
          swapsState: { ...swapsState, customGasPrice: '0x174876e800' },
        })
      })

      it('returns empty object if passed undefined or empty object', async function () {
        assert.deepStrictEqual(
          await swapsController._findTopQuoteAndCalculateSavings(),
          {},
        )
        assert.deepStrictEqual(
          await swapsController._findTopQuoteAndCalculateSavings({}),
          {},
        )
      })

      it('returns the top aggId and quotes with savings and fee values if passed necessary data and an even number of quotes', async function () {
        const [
          topAggId,
          resultQuotes,
        ] = await swapsController._findTopQuoteAndCalculateSavings(
          getTopQuoteAndSavingsMockQuotes(),
        )
        assert.equal(topAggId, TEST_AGG_ID_1)
        assert.deepStrictEqual(
          resultQuotes,
          getTopQuoteAndSavingsBaseExpectedResults(),
        )
      })

      it('returns the top aggId and quotes with savings and fee values if passed necessary data and an odd number of quotes', async function () {
        const testInput = getTopQuoteAndSavingsMockQuotes()
        delete testInput[TEST_AGG_ID_6]
        const expectedResultQuotes = getTopQuoteAndSavingsBaseExpectedResults()
        delete expectedResultQuotes[TEST_AGG_ID_6]
        expectedResultQuotes[TEST_AGG_ID_1].savings = {
          total: '0.0292',
          performance: '0.0297',
          fee: '0.02',
          metaMaskFee: '0.0205',
          medianMetaMaskFee: '0.0202',
        }

        const [
          topAggId,
          resultQuotes,
        ] = await swapsController._findTopQuoteAndCalculateSavings(testInput)
        assert.equal(topAggId, TEST_AGG_ID_1)
        assert.deepStrictEqual(resultQuotes, expectedResultQuotes)
      })

      it('returns the top aggId, without best quote flagged, and quotes with fee values if passed necessary data but no custom convert rate exists', async function () {
        const testInput = mapValues(
          getTopQuoteAndSavingsMockQuotes(),
          (quote) => ({
            ...quote,
            destinationToken: '0xnoConversionRateExists',
          }),
        )
        const expectedResultQuotes = {
          [TEST_AGG_ID_1]: {
            ...testInput[TEST_AGG_ID_1],
            ethFee: '0.01',
          },
          [TEST_AGG_ID_2]: {
            ...testInput[TEST_AGG_ID_2],
            ethFee: '0.02',
          },
          [TEST_AGG_ID_3]: {
            ...testInput[TEST_AGG_ID_3],
            ethFee: '0.03',
          },
          [TEST_AGG_ID_4]: {
            ...testInput[TEST_AGG_ID_4],
            ethFee: '0.04',
          },
          [TEST_AGG_ID_5]: {
            ...testInput[TEST_AGG_ID_5],
            ethFee: '0.05',
          },
          [TEST_AGG_ID_6]: {
            ...testInput[TEST_AGG_ID_6],
            ethFee: '0.06',
          },
        }

        const [
          topAggId,
          resultQuotes,
        ] = await swapsController._findTopQuoteAndCalculateSavings(testInput)
        assert.equal(topAggId, TEST_AGG_ID_1)
        assert.deepStrictEqual(resultQuotes, expectedResultQuotes)
      })

      it('returns the top aggId and quotes with savings and fee values if passed necessary data and the source token is ETH', async function () {
        const testInput = mapValues(
          getTopQuoteAndSavingsMockQuotes(),
          (quote) => ({
            ...quote,
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
          }),
        )
        const baseExpectedResultQuotes = getTopQuoteAndSavingsBaseExpectedResults()
        const expectedResultQuotes = {
          [TEST_AGG_ID_1]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_1],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '2.0195',
          },
          [TEST_AGG_ID_2]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_2],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.9996',
          },
          [TEST_AGG_ID_3]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_3],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.9698',
          },
          [TEST_AGG_ID_4]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_4],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.94',
          },
          [TEST_AGG_ID_5]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_5],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.9102',
          },
          [TEST_AGG_ID_6]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_6],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.8705',
          },
        }

        const [
          topAggId,
          resultQuotes,
        ] = await swapsController._findTopQuoteAndCalculateSavings(testInput)
        assert.equal(topAggId, TEST_AGG_ID_1)
        assert.deepStrictEqual(resultQuotes, expectedResultQuotes)
      })

      it('returns the top aggId and quotes with savings and fee values if passed necessary data and the source token is ETH and an ETH fee is included in the trade value of what would be the best quote', async function () {
        const testInput = mapValues(
          getTopQuoteAndSavingsMockQuotes(),
          (quote) => ({
            ...quote,
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
          }),
        )
        // 0.04 ETH fee included in trade value
        testInput[TEST_AGG_ID_1].trade.value = '0x8b553ece48ec0000'
        const baseExpectedResultQuotes = getTopQuoteAndSavingsBaseExpectedResults()
        const expectedResultQuotes = {
          [TEST_AGG_ID_1]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_1],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8b553ece48ec0000' },
            overallValueOfQuote: '1.9795',
            ethFee: '0.05',
          },
          [TEST_AGG_ID_2]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_2],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.9996',
            isBestQuote: true,
            savings: {
              total: '0.0243',
              performance: '0.0297',
              fee: '0.015',
              metaMaskFee: '0.0204',
              medianMetaMaskFee: '0.0201',
            },
          },
          [TEST_AGG_ID_3]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_3],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.9698',
          },
          [TEST_AGG_ID_4]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_4],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.94',
          },
          [TEST_AGG_ID_5]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_5],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.9102',
          },
          [TEST_AGG_ID_6]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_6],
            sourceToken: ETH_SWAPS_TOKEN_ADDRESS,
            destinationToken: '0x1111111111111111111111111111111111111111',
            trade: { value: '0x8ac7230489e80000' },
            overallValueOfQuote: '1.8705',
          },
        }
        delete expectedResultQuotes[TEST_AGG_ID_1].isBestQuote
        delete expectedResultQuotes[TEST_AGG_ID_1].savings

        const [
          topAggId,
          resultQuotes,
        ] = await swapsController._findTopQuoteAndCalculateSavings(testInput)
        assert.equal(topAggId, TEST_AGG_ID_2)
        assert.deepStrictEqual(resultQuotes, expectedResultQuotes)
      })

      it('returns the top aggId and quotes with savings and fee values if passed necessary data and the source token is not ETH and an ETH fee is included in the trade value of what would be the best quote', async function () {
        const testInput = getTopQuoteAndSavingsMockQuotes()
        // 0.04 ETH fee included in trade value
        testInput[TEST_AGG_ID_1].trade.value = '0x8e1bc9bf040000'
        const baseExpectedResultQuotes = getTopQuoteAndSavingsBaseExpectedResults()
        const expectedResultQuotes = {
          ...baseExpectedResultQuotes,
          [TEST_AGG_ID_1]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_1],
            trade: { value: '0x8e1bc9bf040000' },
            overallValueOfQuote: '1.9795',
            ethFee: '0.05',
          },
          [TEST_AGG_ID_2]: {
            ...baseExpectedResultQuotes[TEST_AGG_ID_2],
            isBestQuote: true,
            savings: {
              total: '0.0243',
              performance: '0.0297',
              fee: '0.015',
              metaMaskFee: '0.0204',
              medianMetaMaskFee: '0.0201',
            },
          },
        }
        delete expectedResultQuotes[TEST_AGG_ID_1].isBestQuote
        delete expectedResultQuotes[TEST_AGG_ID_1].savings

        const [
          topAggId,
          resultQuotes,
        ] = await swapsController._findTopQuoteAndCalculateSavings(testInput)
        assert.equal(topAggId, [TEST_AGG_ID_2])
        assert.deepStrictEqual(resultQuotes, expectedResultQuotes)
      })
    })

    describe('fetchAndSetQuotes', function () {
      it('returns null if fetchParams is not provided', async function () {
        const quotes = await swapsController.fetchAndSetQuotes(undefined)
        assert.strictEqual(quotes, null)
      })

      it('calls fetchTradesInfo with the given fetchParams and returns the correct quotes', async function () {
        fetchTradesInfoStub.resolves(getMockQuotes())

        // Make it so approval is not required
        sandbox
          .stub(swapsController, '_getERC20Allowance')
          .resolves(ethers.BigNumber.from(1))

        const [newQuotes] = await swapsController.fetchAndSetQuotes(
          MOCK_FETCH_PARAMS,
          MOCK_FETCH_METADATA,
        )

        assert.deepStrictEqual(newQuotes[TEST_AGG_ID_BEST], {
          ...getMockQuotes()[TEST_AGG_ID_BEST],
          sourceTokenInfo: undefined,
          destinationTokenInfo: {
            symbol: 'FOO',
            decimals: 18,
          },
          isBestQuote: true,
          // TODO: find a way to calculate these values dynamically
          gasEstimate: 2000000,
          gasEstimateWithRefund: 'b8cae',
          savings: {
            fee: '0',
            metaMaskFee: '0.5050505050505050505',
            performance: '6',
            total: '5.4949494949494949495',
            medianMetaMaskFee: '0.44444444444444444444',
          },
          ethFee: '33554432',
          overallValueOfQuote: '-33554382',
          metaMaskFeeInEth: '0.5050505050505050505',
          ethValueOfTokens: '50',
        })

        assert.strictEqual(
          fetchTradesInfoStub.calledOnceWithExactly(MOCK_FETCH_PARAMS),
          true,
        )
      })

      it('performs the allowance check', async function () {
        fetchTradesInfoStub.resolves(getMockQuotes())

        // Make it so approval is not required
        const allowanceStub = sandbox
          .stub(swapsController, '_getERC20Allowance')
          .resolves(ethers.BigNumber.from(1))

        await swapsController.fetchAndSetQuotes(
          MOCK_FETCH_PARAMS,
          MOCK_FETCH_METADATA,
        )

        assert.strictEqual(
          allowanceStub.calledOnceWithExactly(
            MOCK_FETCH_PARAMS.sourceToken,
            MOCK_FETCH_PARAMS.fromAddress,
          ),
          true,
        )
      })

      it('gets the gas limit if approval is required', async function () {
        fetchTradesInfoStub.resolves(MOCK_QUOTES_APPROVAL_REQUIRED)

        // Ensure approval is required
        sandbox
          .stub(swapsController, '_getERC20Allowance')
          .resolves(ethers.BigNumber.from(0))

        const timedoutGasReturnResult = { gasLimit: 1000000 }
        const timedoutGasReturnStub = sandbox
          .stub(swapsController, 'timedoutGasReturn')
          .resolves(timedoutGasReturnResult)

        await swapsController.fetchAndSetQuotes(
          MOCK_FETCH_PARAMS,
          MOCK_FETCH_METADATA,
        )

        // Mocked quotes approvalNeeded is null, so it will only be called with the gas
        assert.strictEqual(
          timedoutGasReturnStub.calledOnceWithExactly(MOCK_APPROVAL_NEEDED),
          true,
        )
      })

      it('marks the best quote', async function () {
        fetchTradesInfoStub.resolves(getMockQuotes())

        // Make it so approval is not required
        sandbox
          .stub(swapsController, '_getERC20Allowance')
          .resolves(ethers.BigNumber.from(1))

        const [newQuotes, topAggId] = await swapsController.fetchAndSetQuotes(
          MOCK_FETCH_PARAMS,
          MOCK_FETCH_METADATA,
        )

        assert.strictEqual(topAggId, TEST_AGG_ID_BEST)
        assert.strictEqual(newQuotes[topAggId].isBestQuote, true)
      })

      it('selects the best quote', async function () {
        const bestAggId = 'bestAggId'

        // Clone the existing mock quote and increase destination amount
        const bestQuote = {
          ...getMockQuotes()[TEST_AGG_ID_1],
          aggregator: bestAggId,
          destinationAmount: ethers.BigNumber.from(
            getMockQuotes()[TEST_AGG_ID_1].destinationAmount,
          )
            .add((100e18).toString())
            .toString(),
        }
        const quotes = { ...getMockQuotes(), [bestAggId]: bestQuote }
        fetchTradesInfoStub.resolves(quotes)

        // Make it so approval is not required
        sandbox
          .stub(swapsController, '_getERC20Allowance')
          .resolves(ethers.BigNumber.from(1))

        const [newQuotes, topAggId] = await swapsController.fetchAndSetQuotes(
          MOCK_FETCH_PARAMS,
          MOCK_FETCH_METADATA,
        )

        assert.strictEqual(topAggId, bestAggId)
        assert.strictEqual(newQuotes[topAggId].isBestQuote, true)
      })

      it('does not mark as best quote if no conversion rate exists for destination token', async function () {
        fetchTradesInfoStub.resolves(getMockQuotes())

        // Make it so approval is not required
        sandbox
          .stub(swapsController, '_getERC20Allowance')
          .resolves(ethers.BigNumber.from(1))

        swapsController.tokenRatesStore.updateState({
          contractExchangeRates: {},
        })
        const [newQuotes, topAggId] = await swapsController.fetchAndSetQuotes(
          MOCK_FETCH_PARAMS,
          MOCK_FETCH_METADATA,
        )

        assert.strictEqual(newQuotes[topAggId].isBestQuote, undefined)
      })
    })

    describe('resetSwapsState', function () {
      it('resets the swaps state correctly', function () {
        const { swapsState: old } = swapsController.store.getState()
        swapsController.resetSwapsState()
        const { swapsState } = swapsController.store.getState()
        assert.deepStrictEqual(swapsState, {
          ...EMPTY_INIT_STATE.swapsState,
          tokens: old.tokens,
        })
      })

      it('clears polling timeout', function () {
        swapsController.pollingTimeout = setTimeout(
          () => assert.fail(),
          1000000,
        )
        swapsController.resetSwapsState()
        assert.strictEqual(swapsController.pollingTimeout._idleTimeout, -1)
      })
    })

    describe('stopPollingForQuotes', function () {
      it('clears polling timeout', function () {
        swapsController.pollingTimeout = setTimeout(
          () => assert.fail(),
          1000000,
        )
        swapsController.stopPollingForQuotes()
        assert.strictEqual(swapsController.pollingTimeout._idleTimeout, -1)
      })

      it('resets quotes state correctly', function () {
        swapsController.stopPollingForQuotes()
        const { swapsState } = swapsController.store.getState()
        assert.deepStrictEqual(swapsState.quotes, {})
        assert.strictEqual(swapsState.quotesLastFetched, null)
      })
    })

    describe('resetPostFetchState', function () {
      it('clears polling timeout', function () {
        swapsController.pollingTimeout = setTimeout(
          () => assert.fail(),
          1000000,
        )
        swapsController.resetPostFetchState()
        assert.strictEqual(swapsController.pollingTimeout._idleTimeout, -1)
      })

      it('updates state correctly', function () {
        const tokens = 'test'
        const fetchParams = 'test'
        const swapsFeatureIsLive = false
        swapsController.store.updateState({
          swapsState: { tokens, fetchParams, swapsFeatureIsLive },
        })

        swapsController.resetPostFetchState()

        const { swapsState } = swapsController.store.getState()
        assert.deepStrictEqual(swapsState, {
          ...EMPTY_INIT_STATE.swapsState,
          tokens,
          fetchParams,
          swapsFeatureIsLive,
        })
      })
    })

    describe('_setupSwapsLivenessFetching ', function () {
      let clock
      const EXPECTED_TIME = SWAPS_LIVELINESS_CHECK_INTERVAL

      const getLivenessState = () => {
        return swapsController.store.getState().swapsState.swapsFeatureIsLive
      }

      // We have to do this to overwrite window.navigator.onLine
      const stubWindow = () => {
        sandbox.replace(global, 'window', {
          addEventListener: window.addEventListener,
          navigator: { onLine: true },
          dispatchEvent: window.dispatchEvent,
          Event: window.Event,
        })
      }

      beforeEach(function () {
        stubWindow()
        clock = sandbox.useFakeTimers()
        sandbox.spy(clock, 'setInterval')

        sandbox
          .stub(SwapsController.prototype, '_fetchAndSetSwapsLiveness')
          .resolves(undefined)

        sandbox.spy(SwapsController.prototype, '_setupSwapsLivenessFetching')

        sandbox.spy(window, 'addEventListener')
      })

      afterEach(function () {
        sandbox.restore()
      })

      it('calls _setupSwapsLivenessFetching in constructor', function () {
        swapsController = getSwapsController()

        assert.ok(
          swapsController._setupSwapsLivenessFetching.calledOnce,
          'should have called _setupSwapsLivenessFetching once',
        )
        assert.ok(window.addEventListener.calledWith('online'))
        assert.ok(window.addEventListener.calledWith('offline'))
        assert.ok(
          clock.setInterval.calledOnceWithExactly(
            sinon.match.func,
            EXPECTED_TIME,
          ),
          'should have set an interval',
        )
      })

      it('handles browser being offline on boot, then coming online', async function () {
        window.navigator.onLine = false

        swapsController = getSwapsController()
        assert.ok(
          swapsController._setupSwapsLivenessFetching.calledOnce,
          'should have called _setupSwapsLivenessFetching once',
        )
        assert.ok(
          swapsController._fetchAndSetSwapsLiveness.notCalled,
          'should not have called _fetchAndSetSwapsLiveness',
        )
        assert.ok(
          clock.setInterval.notCalled,
          'should not have set an interval',
        )
        assert.strictEqual(
          getLivenessState(),
          false,
          'swaps feature should be disabled',
        )

        const fetchPromise = new Promise((resolve) => {
          const originalFunction = swapsController._fetchAndSetSwapsLiveness
          swapsController._fetchAndSetSwapsLiveness = () => {
            originalFunction()
            resolve()
            swapsController._fetchAndSetSwapsLiveness = originalFunction
          }
        })

        // browser comes online
        window.navigator.onLine = true
        window.dispatchEvent(new window.Event('online'))
        await fetchPromise

        assert.ok(
          swapsController._fetchAndSetSwapsLiveness.calledOnce,
          'should have called _fetchAndSetSwapsLiveness once',
        )
        assert.ok(
          clock.setInterval.calledOnceWithExactly(
            sinon.match.func,
            EXPECTED_TIME,
          ),
          'should have set an interval',
        )
      })

      it('clears interval if browser goes offline', async function () {
        swapsController = getSwapsController()

        // set feature to live
        const { swapsState } = swapsController.store.getState()
        swapsController.store.updateState({
          swapsState: { ...swapsState, swapsFeatureIsLive: true },
        })

        sandbox.spy(swapsController.store, 'updateState')

        assert.ok(
          clock.setInterval.calledOnceWithExactly(
            sinon.match.func,
            EXPECTED_TIME,
          ),
          'should have set an interval',
        )

        const clearIntervalPromise = new Promise((resolve) => {
          const originalFunction = clock.clearInterval
          clock.clearInterval = (intervalId) => {
            originalFunction(intervalId)
            clock.clearInterval = originalFunction
            resolve()
          }
        })

        // browser goes offline
        window.navigator.onLine = false
        window.dispatchEvent(new window.Event('offline'))

        // if this resolves, clearInterval was called
        await clearIntervalPromise

        assert.ok(
          swapsController._fetchAndSetSwapsLiveness.calledOnce,
          'should have called _fetchAndSetSwapsLiveness once',
        )
        assert.ok(
          swapsController.store.updateState.calledOnce,
          'should have called updateState once',
        )
        assert.strictEqual(
          getLivenessState(),
          false,
          'swaps feature should be disabled',
        )
      })
    })

    describe('_fetchAndSetSwapsLiveness', function () {
      const getLivenessState = () => {
        return swapsController.store.getState().swapsState.swapsFeatureIsLive
      }

      beforeEach(function () {
        fetchSwapsFeatureLivenessStub.reset()
        sandbox.stub(SwapsController.prototype, '_setupSwapsLivenessFetching')
        swapsController = getSwapsController()
      })

      afterEach(function () {
        sandbox.restore()
      })

      it('fetches feature liveness as expected when API is live', async function () {
        fetchSwapsFeatureLivenessStub.resolves(true)

        assert.strictEqual(
          getLivenessState(),
          false,
          'liveness should be false on boot',
        )

        await swapsController._fetchAndSetSwapsLiveness()

        assert.ok(
          fetchSwapsFeatureLivenessStub.calledOnce,
          'should have called fetch function once',
        )
        assert.strictEqual(
          getLivenessState(),
          true,
          'liveness should be true after call',
        )
      })

      it('does not update state if fetched value is same as state value', async function () {
        fetchSwapsFeatureLivenessStub.resolves(false)
        sandbox.spy(swapsController.store, 'updateState')

        assert.strictEqual(
          getLivenessState(),
          false,
          'liveness should be false on boot',
        )

        await swapsController._fetchAndSetSwapsLiveness()

        assert.ok(
          fetchSwapsFeatureLivenessStub.calledOnce,
          'should have called fetch function once',
        )
        assert.ok(
          swapsController.store.updateState.notCalled,
          'should not have called store.updateState',
        )
        assert.strictEqual(
          getLivenessState(),
          false,
          'liveness should remain false after call',
        )
      })

      it('tries three times before giving up if fetching fails', async function () {
        const clock = sandbox.useFakeTimers()
        fetchSwapsFeatureLivenessStub.rejects(new Error('foo'))
        sandbox.spy(swapsController.store, 'updateState')

        assert.strictEqual(
          getLivenessState(),
          false,
          'liveness should be false on boot',
        )

        swapsController._fetchAndSetSwapsLiveness()
        await clock.runAllAsync()

        assert.ok(
          fetchSwapsFeatureLivenessStub.calledThrice,
          'should have called fetch function three times',
        )
        assert.ok(
          swapsController.store.updateState.notCalled,
          'should not have called store.updateState',
        )
        assert.strictEqual(
          getLivenessState(),
          false,
          'liveness should remain false after call',
        )
      })

      it('sets state after fetching on successful retry', async function () {
        const clock = sandbox.useFakeTimers()
        fetchSwapsFeatureLivenessStub.onCall(0).rejects(new Error('foo'))
        fetchSwapsFeatureLivenessStub.onCall(1).rejects(new Error('foo'))
        fetchSwapsFeatureLivenessStub.onCall(2).resolves(true)

        assert.strictEqual(
          getLivenessState(),
          false,
          'liveness should be false on boot',
        )

        swapsController._fetchAndSetSwapsLiveness()
        await clock.runAllAsync()

        assert.strictEqual(
          fetchSwapsFeatureLivenessStub.callCount,
          3,
          'should have called fetch function three times',
        )
        assert.strictEqual(
          getLivenessState(),
          true,
          'liveness should be true after call',
        )
      })
    })
  })

  describe('utils', function () {
    describe('getMedianEthValueQuote', function () {
      const { getMedianEthValueQuote } = utils

      it('calculates median correctly with uneven sample', function () {
        const expectedResult = {
          ethFee: '10',
          metaMaskFeeInEth: '5',
          ethValueOfTokens: '0.3',
        }
        const values = [
          {
            overallValueOfQuote: '3',
            ethFee: '10',
            metaMaskFeeInEth: '5',
            ethValueOfTokens: '0.3',
          },
          {
            overallValueOfQuote: '2',
            ethFee: '20',
            metaMaskFeeInEth: '3',
            ethValueOfTokens: '0.2',
          },
          {
            overallValueOfQuote: '6',
            ethFee: '40',
            metaMaskFeeInEth: '6',
            ethValueOfTokens: '0.6',
          },
        ]

        const median = getMedianEthValueQuote(values)

        assert.deepEqual(
          median,
          expectedResult,
          'should have returned correct median quote object',
        )
      })

      it('calculates median correctly with even sample', function () {
        const expectedResult = {
          ethFee: '20',
          metaMaskFeeInEth: '6.5',
          ethValueOfTokens: '0.25',
        }
        const values = [
          {
            overallValueOfQuote: '3',
            ethFee: '10',
            metaMaskFeeInEth: '5',
            ethValueOfTokens: '0.3',
          },
          {
            overallValueOfQuote: '1',
            ethFee: '20',
            metaMaskFeeInEth: '3',
            ethValueOfTokens: '0.2',
          },
          {
            overallValueOfQuote: '2',
            ethFee: '30',
            metaMaskFeeInEth: '8',
            ethValueOfTokens: '0.2',
          },
          {
            overallValueOfQuote: '6',
            ethFee: '40',
            metaMaskFeeInEth: '6',
            ethValueOfTokens: '0.6',
          },
        ]
        const median = getMedianEthValueQuote(values)

        assert.deepEqual(
          median,
          expectedResult,
          'should have returned correct median quote object',
        )
      })

      it('calculates median correctly with an uneven sample where multiple quotes have the median overall value', function () {
        const expectedResult = {
          ethFee: '2',
          metaMaskFeeInEth: '0.5',
          ethValueOfTokens: '5',
        }

        const values = [
          {
            overallValueOfQuote: '1',
            ethValueOfTokens: '2',
            ethFee: '1',
            metaMaskFeeInEth: '0.2',
          },
          {
            overallValueOfQuote: '3',
            ethValueOfTokens: '4',
            ethFee: '1',
            metaMaskFeeInEth: '0.4',
          },
          {
            overallValueOfQuote: '3',
            ethValueOfTokens: '5',
            ethFee: '2',
            metaMaskFeeInEth: '0.5',
          },
          {
            overallValueOfQuote: '3',
            ethValueOfTokens: '6',
            ethFee: '3',
            metaMaskFeeInEth: '0.6',
          },
          {
            overallValueOfQuote: '4',
            ethValueOfTokens: '6',
            ethFee: '2',
            metaMaskFeeInEth: '0.6',
          },
          {
            overallValueOfQuote: '4',
            ethValueOfTokens: '7',
            ethFee: '3',
            metaMaskFeeInEth: '0.7',
          },
          {
            overallValueOfQuote: '6',
            ethValueOfTokens: '8',
            ethFee: '2',
            metaMaskFeeInEth: '0.8',
          },
        ]
        const median = getMedianEthValueQuote(values)

        assert.deepEqual(
          median,
          expectedResult,
          'should have returned correct median quote object',
        )
      })

      it('calculates median correctly with an even sample where multiple quotes have the same overall value as either of the two middle values', function () {
        const expectedResult = {
          ethFee: '2',
          metaMaskFeeInEth: '0.55',
          ethValueOfTokens: '5.5',
        }

        const values = [
          {
            overallValueOfQuote: '1',
            ethValueOfTokens: '2',
            ethFee: '1',
            metaMaskFeeInEth: '0.2',
          },
          {
            overallValueOfQuote: '3',
            ethValueOfTokens: '4',
            ethFee: '1',
            metaMaskFeeInEth: '0.4',
          },
          {
            overallValueOfQuote: '3',
            ethValueOfTokens: '5',
            ethFee: '2',
            metaMaskFeeInEth: '0.5',
          },
          {
            overallValueOfQuote: '4',
            ethValueOfTokens: '6',
            ethFee: '2',
            metaMaskFeeInEth: '0.6',
          },
          {
            overallValueOfQuote: '4',
            ethValueOfTokens: '7',
            ethFee: '3',
            metaMaskFeeInEth: '0.7',
          },
          {
            overallValueOfQuote: '6',
            ethValueOfTokens: '8',
            ethFee: '2',
            metaMaskFeeInEth: '0.8',
          },
        ]
        const median = getMedianEthValueQuote(values)

        assert.deepEqual(
          median,
          expectedResult,
          'should have returned correct median quote object',
        )
      })

      it('throws on empty or non-array sample', function () {
        assert.throws(
          () => getMedianEthValueQuote([]),
          'should throw on empty array',
        )

        assert.throws(
          () => getMedianEthValueQuote(),
          'should throw on non-array param',
        )

        assert.throws(
          () => getMedianEthValueQuote({}),
          'should throw on non-array param',
        )
      })
    })
  })
})

function getMockQuotes() {
  return {
    [TEST_AGG_ID_1]: {
      trade: {
        from: '0xe18035bf8712672935fdb4e5e431b1a0183d2dfc',
        value: '0x0',
        gas: '0x61a80', // 4e5
        to: '0x881D40237659C251811CEC9c364ef91dC08D300C',
      },
      sourceAmount: '10000000000000000000', // 10e18
      destinationAmount: '20000000000000000000', // 20e18
      error: null,
      sourceToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
      destinationToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      approvalNeeded: null,
      maxGas: 600000,
      averageGas: 120000,
      estimatedRefund: 80000,
      fetchTime: 607,
      aggregator: TEST_AGG_ID_1,
      aggType: 'AGG',
      slippage: 2,
      sourceTokenInfo: {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        symbol: 'DAI',
        decimals: 18,
        iconUrl: 'https://foo.bar/logo.png',
      },
      destinationTokenInfo: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        decimals: 18,
      },
      fee: 1,
    },

    [TEST_AGG_ID_BEST]: {
      trade: {
        from: '0xe18035bf8712672935fdb4e5e431b1a0183d2dfc',
        value: '0x0',
        gas: '0x61a80',
        to: '0x881D40237659C251811CEC9c364ef91dC08D300C',
      },
      sourceAmount: '10000000000000000000',
      destinationAmount: '25000000000000000000', // 25e18
      error: null,
      sourceToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
      destinationToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      approvalNeeded: null,
      maxGas: 1100000,
      averageGas: 411000,
      estimatedRefund: 343090,
      fetchTime: 1003,
      aggregator: TEST_AGG_ID_BEST,
      aggType: 'AGG',
      slippage: 2,
      sourceTokenInfo: {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        symbol: 'DAI',
        decimals: 18,
        iconUrl: 'https://foo.bar/logo.png',
      },
      destinationTokenInfo: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        decimals: 18,
      },
      fee: 1,
    },

    [TEST_AGG_ID_2]: {
      trade: {
        from: '0xe18035bf8712672935fdb4e5e431b1a0183d2dfc',
        value: '0x0',
        gas: '0x61a80',
        to: '0x881D40237659C251811CEC9c364ef91dC08D300C',
      },
      sourceAmount: '10000000000000000000',
      destinationAmount: '22000000000000000000', // 22e18
      error: null,
      sourceToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
      destinationToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      approvalNeeded: null,
      maxGas: 368000,
      averageGas: 197000,
      estimatedRefund: 18205,
      fetchTime: 1354,
      aggregator: TEST_AGG_ID_2,
      aggType: 'AGG',
      slippage: 2,
      sourceTokenInfo: {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        symbol: 'DAI',
        decimals: 18,
        iconUrl: 'https://foo.bar/logo.png',
      },
      destinationTokenInfo: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        decimals: 18,
      },
      fee: 1,
    },
  }
}

function getTopQuoteAndSavingsMockQuotes() {
  // These destination amounts are calculated using the following "pre-fee" amounts
  // TEST_AGG_ID_1: 20.5
  // TEST_AGG_ID_2: 20.4
  // TEST_AGG_ID_3: 20.2
  // TEST_AGG_ID_4: 20
  // TEST_AGG_ID_5: 19.8
  // TEST_AGG_ID_6: 19.5

  return {
    [TEST_AGG_ID_1]: {
      aggregator: TEST_AGG_ID_1,
      approvalNeeded: null,
      gasEstimate: '0x186a0',
      destinationAmount: '20295000000000000000',
      destinationToken: '0x1111111111111111111111111111111111111111',
      destinationTokenInfo: { decimals: 18 },
      sourceAmount: '10000000000000000000',
      sourceToken: '0xsomeERC20TokenAddress',
      trade: {
        value: '0x0',
      },
      fee: 1,
    },
    [TEST_AGG_ID_2]: {
      aggregator: TEST_AGG_ID_2,
      approvalNeeded: null,
      gasEstimate: '0x30d40',
      destinationAmount: '20196000000000000000',
      destinationToken: '0x1111111111111111111111111111111111111111',
      destinationTokenInfo: { decimals: 18 },
      sourceAmount: '10000000000000000000',
      sourceToken: '0xsomeERC20TokenAddress',
      trade: {
        value: '0x0',
      },
      fee: 1,
    },
    [TEST_AGG_ID_3]: {
      aggregator: TEST_AGG_ID_3,
      approvalNeeded: null,
      gasEstimate: '0x493e0',
      destinationAmount: '19998000000000000000',
      destinationToken: '0x1111111111111111111111111111111111111111',
      destinationTokenInfo: { decimals: 18 },
      sourceAmount: '10000000000000000000',
      sourceToken: '0xsomeERC20TokenAddress',
      trade: {
        value: '0x0',
      },
      fee: 1,
    },
    [TEST_AGG_ID_4]: {
      aggregator: TEST_AGG_ID_4,
      approvalNeeded: null,
      gasEstimate: '0x61a80',
      destinationAmount: '19800000000000000000',
      destinationToken: '0x1111111111111111111111111111111111111111',
      destinationTokenInfo: { decimals: 18 },
      sourceAmount: '10000000000000000000',
      sourceToken: '0xsomeERC20TokenAddress',
      trade: {
        value: '0x0',
      },
      fee: 1,
    },
    [TEST_AGG_ID_5]: {
      aggregator: TEST_AGG_ID_5,
      approvalNeeded: null,
      gasEstimate: '0x7a120',
      destinationAmount: '19602000000000000000',
      destinationToken: '0x1111111111111111111111111111111111111111',
      destinationTokenInfo: { decimals: 18 },
      sourceAmount: '10000000000000000000',
      sourceToken: '0xsomeERC20TokenAddress',
      trade: {
        value: '0x0',
      },
      fee: 1,
    },
    [TEST_AGG_ID_6]: {
      aggregator: TEST_AGG_ID_6,
      approvalNeeded: null,
      gasEstimate: '0x927c0',
      destinationAmount: '19305000000000000000',
      destinationToken: '0x1111111111111111111111111111111111111111',
      destinationTokenInfo: { decimals: 18 },
      sourceAmount: '10000000000000000000',
      sourceToken: '0xsomeERC20TokenAddress',
      trade: {
        value: '0x0',
      },
      fee: 1,
    },
  }
}

function getTopQuoteAndSavingsBaseExpectedResults() {
  const baseTestInput = getTopQuoteAndSavingsMockQuotes()
  return {
    [TEST_AGG_ID_1]: {
      ...baseTestInput[TEST_AGG_ID_1],
      isBestQuote: true,
      ethFee: '0.01',
      overallValueOfQuote: '2.0195',
      metaMaskFeeInEth: '0.0205',
      ethValueOfTokens: '2.0295',
      savings: {
        total: '0.0441',
        performance: '0.0396',
        fee: '0.025',
        metaMaskFee: '0.0205',
        medianMetaMaskFee: '0.0201',
      },
    },
    [TEST_AGG_ID_2]: {
      ...baseTestInput[TEST_AGG_ID_2],
      ethFee: '0.02',
      overallValueOfQuote: '1.9996',
      metaMaskFeeInEth: '0.0204',
      ethValueOfTokens: '2.0196',
    },
    [TEST_AGG_ID_3]: {
      ...baseTestInput[TEST_AGG_ID_3],
      ethFee: '0.03',
      overallValueOfQuote: '1.9698',
      metaMaskFeeInEth: '0.0202',
      ethValueOfTokens: '1.9998',
    },
    [TEST_AGG_ID_4]: {
      ...baseTestInput[TEST_AGG_ID_4],
      ethFee: '0.04',
      overallValueOfQuote: '1.94',
      metaMaskFeeInEth: '0.02',
      ethValueOfTokens: '1.98',
    },
    [TEST_AGG_ID_5]: {
      ...baseTestInput[TEST_AGG_ID_5],
      ethFee: '0.05',
      overallValueOfQuote: '1.9102',
      metaMaskFeeInEth: '0.0198',
      ethValueOfTokens: '1.9602',
    },
    [TEST_AGG_ID_6]: {
      ...baseTestInput[TEST_AGG_ID_6],
      ethFee: '0.06',
      overallValueOfQuote: '1.8705',
      metaMaskFeeInEth: '0.0195',
      ethValueOfTokens: '1.9305',
    },
  }
}
