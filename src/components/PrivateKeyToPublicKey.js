import React, { Component } from 'react'
import cx from 'classnames'
import { fromEvent, merge, Subject } from 'rxjs'
import { map, filter, tap } from 'rxjs/operators'
import keccak256 from 'keccak256'

import Input from 'components/Input'
import ArrowDown from 'components/ArrowDown'
import ec from 'utils/elliptic'
import { putSubscriptions, unsubscribeAll, onlyWhenDesktop } from 'utils/stream'

import './PrivateKeyToPublicKey.scss'

type Props = {

}

class PrivateKeyToPublicKey extends Component<Props> {
  state = {
    publicAddress: '',
    focused: '',
    changeTarget: {},
    removeTarget: {},
    isForEmjay: false,
  }

  subscriptions = []

  privateKeySubject = new Subject()

  initInputChangeStreams = () => {
    // Input Change Streams
    const privateKeyChange$ = merge(
      fromEvent(this.$privateKey, 'input').pipe(
        map(e => e.target.value.replace('0x', ''))
      ),
      this.privateKeySubject.pipe(
        tap((privateKey) => {
          this.$privateKey.value = privateKey
        }),
        map(privateKey => privateKey.replace('0x', '')),
      ),
    )

    const publicKeyChange$ = merge(
      privateKeyChange$.pipe(
        map(pvkey => {
          try {
            const uncompressedFormPublicKey = '0x' + ec.keyFromPrivate(pvkey.replace('0x', ''), 'hex').getPublic(false, 'hex')
            const publicKey = '0x' + uncompressedFormPublicKey.replace('0x', '').slice(2)
            
            return this.state.isForEmjay ? uncompressedFormPublicKey : publicKey
          } catch (e) {
            console.log(e, 'e')
            return ''
          }
        })
      ),
      fromEvent(this.$publicKey, 'input').pipe(
        tap(this.clearPrivateKey),
        map(e => e.target.value),
      )
    )

    putSubscriptions(
      this.subscriptions,
      publicKeyChange$.subscribe(pbkeyRaw => {
          if (this.$publicKey.value !== pbkeyRaw) this.$publicKey.value = pbkeyRaw
          const pbkey = pbkeyRaw.startsWith('0x') ? pbkeyRaw : '0x' + pbkeyRaw
          
          this.setState({
            publicAddress: pbkey !== '0x'
              ? '0x' + keccak256(pbkey.replace('0x04', '0x')).toString('hex').slice(-40)
              : ''
          })
        })
    )
  }

  initActiveStreams = () => {
    const privateKeyFocus$ = fromEvent(this.$privateKey, 'focus')
    const privateKeyMouseEnter$ = onlyWhenDesktop(fromEvent(this.$privateKey, 'mouseenter'))
    const privateKeyActive$ = merge(privateKeyFocus$, privateKeyMouseEnter$).pipe(
      tap(() => {
        this.setState({
          changeTarget: {
            publicKey: true,
            publicAddress: true,
          }
        })
      })
    )

    const publicKeyFocus$ = fromEvent(this.$publicKey, 'focus')
    const publicKeyMouseEnter$ = onlyWhenDesktop(fromEvent(this.$publicKey, 'mouseenter'))
    const publicKeyActive$ = merge(publicKeyFocus$, publicKeyMouseEnter$).pipe(
      tap(() => {
        this.setState({
          changeTarget: {
            publicAddress: true,
          },
          removeTarget: {
            privateKey: true,
          }
        })
      })
    )

    putSubscriptions(
      this.subscriptions,
      privateKeyActive$.subscribe(),
      publicKeyActive$.subscribe()
    )
  }

  initDeactiveStreams = () => {
    const blur$ = merge(
      fromEvent(this.$privateKey, 'blur'),
      fromEvent(this.$publicKey, 'blur')
    )
    const mouseleave$ = merge(
      fromEvent(this.$privateKey, 'mouseleave'),
      fromEvent(this.$publicKey, 'mouseleave')
    )

    const deactive$ = merge(blur$, mouseleave$).pipe(
      filter((e) => document.activeElement !== e.fromElement),
      tap(() => {
        this.setState({
          changeTarget: {},
          removeTarget: {},
        })
      })
    )

    putSubscriptions(
      this.subscriptions,
      deactive$.subscribe()
    )
  }

  clearPrivateKey = () => {
    this.$privateKey.value = ''
  }

  genPrivateKey = () => {
    const generatedPrivateKey = '0x' + ec.genKeyPair().getPrivate().toString(16)
    this.privateKeySubject.next(generatedPrivateKey)
  }
  
  handleCheck = () => {
    this.setState({ isForEmjay: !this.state.isForEmjay }, () => {
      const uncompressedFormIndicator = '0x04'
      
      const isAlreadyForEmjay = this.$publicKey.value.slice(0, 4) === uncompressedFormIndicator
      
      if (this.state.isForEmjay && !isAlreadyForEmjay) {
        this.$publicKey.value = uncompressedFormIndicator + this.$publicKey.value.slice(2)
        return
      }
    
      this.$publicKey.value = isAlreadyForEmjay
        ? '0x' + this.$publicKey.value.slice(4)
        : this.$publicKey.value
    })
  }

  componentDidMount() {
    this.initInputChangeStreams()
    this.initActiveStreams()
    this.initDeactiveStreams()
  }

  componentWillUnmount() {
    unsubscribeAll(this.subscriptions)
  }

  render() {
    const { publicAddress, changeTarget, removeTarget, isForEmjay } = this.state
    return (
      <div className="PrivateKeyToPublicKey">
        <button className="PrivateKeyToPublicKey__generateButton" onClick={this.genPrivateKey}>Generate!</button>
        <div className="PrivateKeyToPublicKey__inputWrapper PrivateKeyToPublicKey__inputWrapper--privateKey">
          <label className="PrivateKeyToPublicKey__label">Private key:</label>
          <input
            className={cx('PrivateKeyToPublicKey__privateKey', {
              'PrivateKeyToPublicKey__privateKey--changeTarget': changeTarget.privateKey,
              'PrivateKeyToPublicKey__privateKey--removeTarget': removeTarget.privateKey,
            })}
            ref={($privateKey) => this.$privateKey = $privateKey}
          />
        </div>
        <ArrowDown visible={changeTarget.publicKey} />
        <div className="PrivateKeyToPublicKey__inputWrapper PrivateKeyToPublicKey__inputWrapper--publicKey">
          <label className="PrivateKeyToPublicKey__label">Public key:</label>
          <label>
            <input
              type="checkbox"
              checked={isForEmjay}
              onChange={this.handleCheck}
            />
            Show uncompressed / compressed indicator
          </label>
          <textarea
            className={cx('PrivateKeyToPublicKey__publicKey', {
              'PrivateKeyToPublicKey__publicKey--changeTarget': changeTarget.publicKey
            })}
            ref={($publicKey) => this.$publicKey = $publicKey}
          />
        </div>
        <ArrowDown visible={changeTarget.publicAddress} />
        <div className="PrivateKeyToPublicKey__inputWrapper PrivateKeyToPublicKey__inputWrapper--publicAddress">
          <label className="PrivateKeyToPublicKey__label">Public address:</label>
          <input
            className={cx('PrivateKeyToPublicKey__publicAddress', {
              'PrivateKeyToPublicKey__publicAddress--changeTarget': changeTarget.publicAddress,
            })}
            ref={($publicAddress) => this.$publicAddress = $publicAddress}
            value={publicAddress}
            readOnly
          />
        </div>
      </div>
    )
  }
}

export default PrivateKeyToPublicKey
