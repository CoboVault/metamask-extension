import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { INITIALIZE_IMPORT_COBO_VAULT_ROUTE } from '../../../helpers/constants/routes'
import MetaFoxLogo from '../../../components/ui/metafox-logo'
import Button from '../../../components/ui/button'

export default class CreateCoboVaultHint extends Component {
  static contextTypes = {
    t: PropTypes.func,
  }

  static propTypes = {
    history: PropTypes.object.isRequired,
  }

  handleContinue() {
    this.props.history.push(INITIALIZE_IMPORT_COBO_VAULT_ROUTE)
  }

  render() {
    const { t } = this.context
    return (
      <div className="first-time-flow__wrapper">
        <MetaFoxLogo />
        <div className="create-cobo-vault-hint">
          <div className="first-time-flow__header">{t('syncCoboTitle')}</div>
          <p className="create-cobo-vault-hint__text">{t('syncStep1')}</p>
          <p className="create-cobo-vault-hint__text">{t('syncStep2')}</p>
          <p className="create-cobo-vault-hint__text">{t('syncStep3')}</p>
          <p className="create-cobo-vault-hint__text">{t('syncStep4')}</p>
          <p className="create-cobo-vault-hint__hint">{t('syncSubMessage')}</p>
          <a className="create-cobo-vault-hint__link" href={t('syncLink')}>
            {t('syncLinkDescription')}
          </a>
        </div>
        <Button
          type="primary"
          className="first-time-flow__button"
          onClick={() => this.handleContinue()}
        >
          {t('syncCobo')}
        </Button>
      </div>
    )
  }
}
