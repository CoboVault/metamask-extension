import React from 'react'
import PropTypes from 'prop-types'
import { useHistory } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'

import { showModal } from '../../../store/actions'
import { CONNECTED_ROUTE } from '../../../helpers/constants/routes'
import { Menu, MenuItem } from '../../ui/menu'
import getAccountLink from '../../../../lib/account-link'
import {
  getCurrentNetwork,
  getRpcPrefsForCurrentProvider,
  getSelectedIdentity,
} from '../../../selectors'
import { useI18nContext } from '../../../hooks/useI18nContext'
import { getEnvironmentType } from '../../../../../app/scripts/lib/util'
import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../../../../app/scripts/lib/enums'

export default function AccountOptionsMenu({ anchorElement, onClose }) {
  const t = useI18nContext()
  const dispatch = useDispatch()
  const history = useHistory()

  const network = useSelector(getCurrentNetwork)
  const rpcPrefs = useSelector(getRpcPrefsForCurrentProvider)
  const selectedIdentity = useSelector(getSelectedIdentity)

  const { address } = selectedIdentity

  return (
    <Menu
      anchorElement={anchorElement}
      className="account-options-menu"
      onHide={onClose}
    >
      {getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN ? null : (
        <MenuItem
          onClick={() => {
            global.platform.openExtensionInBrowser()
            onClose()
          }}
          iconClassName="fas fa-expand-alt"
        >
          {t('expandView')}
        </MenuItem>
      )}
      <MenuItem
        data-testid="account-options-menu__account-details"
        onClick={() => {
          dispatch(showModal({ name: 'ACCOUNT_DETAILS' }))
          onClose()
        }}
        iconClassName="fas fa-qrcode"
      >
        {t('accountDetails')}
      </MenuItem>
      <MenuItem
        onClick={() => {
          global.platform.openTab({
            url: getAccountLink(address, network, rpcPrefs),
          })
          onClose()
        }}
        subtitle={
          rpcPrefs.blockExplorerUrl ? (
            <span className="account-options-menu__explorer-origin">
              {rpcPrefs.blockExplorerUrl.match(/^https?:\/\/(.+)/u)[1]}
            </span>
          ) : null
        }
        iconClassName="fas fa-external-link-alt"
      >
        {rpcPrefs.blockExplorerUrl ? t('viewinExplorer') : t('viewOnEtherscan')}
      </MenuItem>
      <MenuItem
        data-testid="account-options-menu__connected-sites"
        onClick={() => {
          history.push(CONNECTED_ROUTE)
          onClose()
        }}
        iconClassName="account-options-menu__connected-sites"
      >
        {t('connectedSites')}
      </MenuItem>
    </Menu>
  )
}

AccountOptionsMenu.propTypes = {
  anchorElement: PropTypes.instanceOf(window.Element),
  onClose: PropTypes.func.isRequired,
}

AccountOptionsMenu.defaultProps = {
  anchorElement: undefined,
}
