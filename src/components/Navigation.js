import React, { useState } from 'react';
import { ethers } from 'ethers';
import logo from '../assets/logo.svg';

const Navigation = ({ 
  account, 
  setAccount, 
  balance, 
  networkName, 
  chainId, 
  roles, 
  onOpenRoleModal,
  onOpenListModal,
  onSwitchNetwork 
}) => {
  const [copied, setCopied] = useState(false);

  const connectHandler = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = ethers.utils.getAddress(accounts[0]);
        setAccount(account);
      } catch (err) {
        console.error("User rejected wallet connection:", err);
      }
    } else {
      alert("No Web3 wallet detected! Please install MetaMask or use the Role Testing Hub to explore.");
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine user's current role
  let currentRoleBadge = null;
  if (account && roles) {
    const accLower = account.toLowerCase();
    if (roles.buyer && accLower === roles.buyer.toLowerCase()) {
      currentRoleBadge = { label: "Buyer", icon: "🛍️", className: "badge-buyer" };
    } else if (roles.seller && accLower === roles.seller.toLowerCase()) {
      currentRoleBadge = { label: "Seller", icon: "🏷️", className: "badge-seller" };
    } else if (roles.inspector && accLower === roles.inspector.toLowerCase()) {
      currentRoleBadge = { label: "Inspector", icon: "🔍", className: "badge-inspector" };
    } else if (roles.lender && accLower === roles.lender.toLowerCase()) {
      currentRoleBadge = { label: "Lender", icon: "🏦", className: "badge-lender" };
    }
  }

  const isLocalhost = chainId === 31337 || chainId === '31337' || chainId === 1337;

  return (
    <nav className="navbar">
      <div className="navbar__brand-container">
        <a href="#home" className="navbar__brand">
          <div className="navbar__logo-wrapper">
            <img src={logo} alt="Millow Escrow" className="navbar__logo" />
          </div>
          <div className="navbar__brand-text">
            <span className="navbar__brand-name">MILLOW</span>
            <span className="navbar__brand-tagline">On-Chain Real Estate Escrow</span>
          </div>
        </a>
      </div>

      <div className="navbar__center-nav">
        <button 
          className="nav-action-pill"
          onClick={onOpenRoleModal}
          title="Explore participant accounts & roles"
        >
          <span className="pill-dot"></span>
          <span>Role Testing Hub</span>
        </button>

        <button 
          className="nav-action-pill nav-action-pill--gold"
          onClick={onOpenListModal}
          title="List a new property"
        >
          <span>+ Mint & List</span>
        </button>
      </div>

      <div className="navbar__wallet-group">
        {/* Network indicator */}
        <div 
          className={`network-badge ${isLocalhost ? 'network-badge--valid' : 'network-badge--warning'}`}
          onClick={!isLocalhost ? onSwitchNetwork : undefined}
          title={isLocalhost ? "Connected to Localhost Node" : "Click to switch to Localhost (31337)"}
        >
          <span className="network-indicator-dot"></span>
          <span>{isLocalhost ? `Localhost (${chainId})` : `Net: ${chainId || 'Unknown'}`}</span>
          {!isLocalhost && <span className="network-switch-hint">Switch</span>}
        </div>

        {/* User Role Badge if detected */}
        {currentRoleBadge && (
          <div className={`role-badge ${currentRoleBadge.className}`} title={`You are signed in as ${currentRoleBadge.label}`}>
            <span>{currentRoleBadge.icon}</span>
            <span>{currentRoleBadge.label}</span>
          </div>
        )}

        {/* Account balance and connect button */}
        {account ? (
          <div className="account-pill">
            {balance && <span className="account-pill__balance">{balance} ETH</span>}
            <button 
              type="button" 
              className="account-pill__btn"
              onClick={copyAddress}
              title="Click to copy full wallet address"
            >
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
              <span className="copy-icon">{copied ? '✓' : '📋'}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="connect-wallet-btn"
            onClick={connectHandler}
          >
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navigation;