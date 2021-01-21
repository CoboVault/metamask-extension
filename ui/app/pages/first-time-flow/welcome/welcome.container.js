import { connect } from 'react-redux'
import { withRouter } from 'react-router-dom'
import { compose } from 'redux'
import {
  closeWelcomeScreen,
  setFirstTimeFlowType,
} from '../../../store/actions'
import Welcome from './welcome.component'

const mapStateToProps = ({ metamask }) => {
  const { welcomeScreenSeen } = metamask

  return {
    welcomeScreenSeen,
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    closeWelcomeScreen: () => dispatch(closeWelcomeScreen()),
  }
}

export default compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
)(Welcome)
