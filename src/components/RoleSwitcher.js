import React, { useState } from 'react';

const HARDHAT_ROLES = [
  {
    role: "Buyer",
    tag: "Account #0",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    description: "Deposits earnest money deposit (escrow) & approves purchase.",
    icon: "🛍️",
    color: "#38bdf8"
  },
  {
    role: "Seller",
    tag: "Account #1",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    description: "Mints property NFTs, lists on escrow, approves & finalizes sale.",
    icon: "🏷️",
    color: "#e5b869"
  },
  {
    role: "Inspector",
    tag: "Account #2",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b93908f298509fe63943923c4a783738b58a1c7a73a21c6428c",
    description: "Performs physical property appraisal & updates inspection status.",
    icon: "🔍",
    color: "#a855f7"
  },
  {
    role: "Lender",
    tag: "Account #3",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    privateKey: "0x7c852118294e51e653712a4f6e3c09b2e8d35e07663f703511eb9c0a66d0ef04",
    description: "Approves loan & advances remaining purchase price into escrow.",
    icon: "🏦",
    color: "#10b981"
  }
];

const RoleSwitcher = ({ currentAccount, onClose, onSelectAccount }) => {
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__container role-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title-group">
            <span className="modal__badge">Localhost Testing Hub</span>
            <h2>Escrow Participant Roles</h2>
            <p>Switch between accounts in MetaMask or simulate actions directly.</p>
          </div>
          <button className="modal__close-btn" onClick={onClose} aria-label="Close modal">×</button>
        </div>

        <div className="role-modal__grid">
          {HARDHAT_ROLES.map((item, idx) => {
            const isActive = currentAccount && currentAccount.toLowerCase() === item.address.toLowerCase();
            return (
              <div 
                key={idx} 
                className={`role-card ${isActive ? 'role-card--active' : ''}`}
                style={{ borderColor: isActive ? item.color : undefined }}
              >
                <div className="role-card__top">
                  <div className="role-card__icon" style={{ background: `${item.color}20`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div>
                    <div className="role-card__header">
                      <h3>{item.role}</h3>
                      <span className="role-card__tag">{item.tag}</span>
                    </div>
                    {isActive && <span className="role-card__status-active">● Currently Connected</span>}
                  </div>
                </div>

                <p className="role-card__desc">{item.description}</p>

                <div className="role-card__address-box">
                  <span className="role-card__label">Public Address:</span>
                  <div className="role-card__copy-row">
                    <code>{item.address.slice(0, 10)}...{item.address.slice(-8)}</code>
                    <button 
                      className="copy-btn" 
                      onClick={() => handleCopy(item.address, `addr-${idx}`)}
                    >
                      {copiedKey === `addr-${idx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="role-card__address-box">
                  <span className="role-card__label">Private Key (Import to MetaMask):</span>
                  <div className="role-card__copy-row">
                    <code>{item.privateKey.slice(0, 8)}...{item.privateKey.slice(-6)}</code>
                    <button 
                      className="copy-btn copy-btn--subtle" 
                      onClick={() => handleCopy(item.privateKey, `pk-${idx}`)}
                    >
                      {copiedKey === `pk-${idx}` ? 'Copied!' : 'Copy Key'}
                    </button>
                  </div>
                </div>

                <button 
                  className={`role-card__action-btn ${isActive ? 'btn-active' : ''}`}
                  onClick={() => {
                    if (onSelectAccount) onSelectAccount(item.address);
                    onClose();
                  }}
                >
                  {isActive ? 'Current Account' : `Select as ${item.role}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="role-modal__footer">
          <div className="role-modal__tip">
            💡 <strong>Quick Tip:</strong> To execute transactions on Localhost, import these accounts into MetaMask using their Private Keys and connect to <code>Localhost 8545</code> (Chain ID <code>31337</code>).
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSwitcher;
