import { compose } from 'redux'
import { connect } from 'react-redux'
import { withRouter } from 'react-router-dom'
import {
  setFeatureFlag,
  setUsePhishDetect,
} from '../../../store/actions'
import SecurityTab from './security-tab.component'

const mapStateToProps = (state) => {
  const {
    appState: { warning },
    metamask,
  } = state
  const {
    featureFlags: { showIncomingTransactions } = {},
    usePhishDetect,
  } = metamask

  return {
    warning,
    showIncomingTransactions,
    usePhishDetect,
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setShowIncomingTransactionsFeatureFlag: (shouldShow) =>
      dispatch(setFeatureFlag('showIncomingTransactions', shouldShow)),
    setUsePhishDetect: (val) => dispatch(setUsePhishDetect(val)),
  }
}

export default compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
)(SecurityTab)
