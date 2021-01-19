import { connect } from 'react-redux'
import { setParticipateInMetaMetrics } from '../../../store/actions'
import { getFirstTimeFlowTypeRoute } from '../../../selectors'
import MetaMetricsOptIn from './metametrics-opt-in.component'
import { INITIALIZE_CREATE_NEW_VAULT_ROUTE } from "../../../helpers/constants/routes";

const firstTimeFlowTypeNameMap = {
  create: 'Selected Create New Wallet',
  import: 'Selected Import Wallet',
}

const mapStateToProps = (state) => {
  const { firstTimeFlowType, participateInMetaMetrics } = state.metamask

  return {
    nextRoute: INITIALIZE_CREATE_NEW_VAULT_ROUTE,
    firstTimeSelectionMetaMetricsName:
      firstTimeFlowTypeNameMap[firstTimeFlowType],
    participateInMetaMetrics,
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setParticipateInMetaMetrics: (val) =>
      dispatch(setParticipateInMetaMetrics(val)),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(MetaMetricsOptIn)
