import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import close from '../assets/close.svg';

const Home = ({ home, provider, account, escrow, realEstate, roles, togglePop, onOpenRoleModal }) => {
  const [hasBought, setHasBought] = useState(false);
  const [hasLended, setHasLended] = useState(false);
  const [hasInspected, setHasInspected] = useState(false);
  const [hasSold, setHasSold] = useState(false);

  const [buyer, setBuyer] = useState(null);
  const [lender, setLender] = useState(null);
  const [inspector, setInspector] = useState(null);
  const [seller, setSeller] = useState(null);

  const [isListed, setIsListed] = useState(true);
  const [owner, setOwner] = useState(null);
  const [contractBalance, setContractBalance] = useState('0');
  const [purchasePriceETH, setPurchasePriceETH] = useState('0');
  const [escrowAmountETH, setEscrowAmountETH] = useState('0');
  const [loanAmountETH, setLoanAmountETH] = useState('0');

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'escrow' | 'financials'

  const fetchDetails = async () => {
    if (!escrow || !home.id) return;
    try {
      // 1. Roles
      const b = await escrow.buyer(home.id);
      setBuyer(b);

      const s = await escrow.seller();
      setSeller(s);

      const l = await escrow.lender();
      setLender(l);

      const ins = await escrow.inspector();
      setInspector(ins);

      // 2. Approvals
      const bought = await escrow.approval(home.id, b);
      setHasBought(bought);

      const sold = await escrow.approval(home.id, s);
      setHasSold(sold);

      const lended = await escrow.approval(home.id, l);
      setHasLended(lended);

      const inspected = await escrow.inspectionPassed(home.id);
      setHasInspected(inspected);

      // 3. Status & Balances
      const listed = await escrow.isListed(home.id);
      setIsListed(listed);

      const pPrice = await escrow.purchasePrice(home.id);
      const eAmount = await escrow.escrowAmount(home.id);
      const lAmount = pPrice.sub(eAmount);

      setPurchasePriceETH(ethers.utils.formatEther(pPrice));
      setEscrowAmountETH(ethers.utils.formatEther(eAmount));
      setLoanAmountETH(ethers.utils.formatEther(lAmount));

      const balance = await escrow.getBalance();
      setContractBalance(ethers.utils.formatEther(balance));

      // 4. Current Owner
      if (!listed) {
        setOwner(b);
      } else if (realEstate) {
        try {
          const currentNftOwner = await realEstate.ownerOf(home.id);
          if (currentNftOwner.toLowerCase() !== escrow.address.toLowerCase()) {
            setOwner(currentNftOwner);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error("Error fetching escrow property details:", err);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.id, escrow]);

  // Buyer: Deposit Earnest & Approve
  const buyHandler = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setStatusMessage("1/2: Submitting earnest deposit to escrow contract...");

      const signer = provider.getSigner();
      const escrowAmount = await escrow.escrowAmount(home.id);

      const depositTx = await escrow.connect(signer).depositEarnest(home.id, { value: escrowAmount });
      await depositTx.wait();

      setStatusMessage("2/2: Authorizing purchase approval...");
      const approveTx = await escrow.connect(signer).approveSale(home.id);
      await approveTx.wait();

      setHasBought(true);
      setStatusMessage("✔ Earnest deposit locked & sale approved by Buyer!");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Transaction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Inspector: Update Status
  const inspectHandler = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setStatusMessage("Updating on-chain inspection status...");

      const signer = provider.getSigner();
      const tx = await escrow.connect(signer).updateInspectionStatus(home.id, true);
      await tx.wait();

      setHasInspected(true);
      setStatusMessage("✔ Property inspection officially approved on-chain!");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Inspection update failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Lender: Approve and Send Remaining Funds
  const lendHandler = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setStatusMessage("1/2: Approving mortgage financing...");

      const signer = provider.getSigner();
      const approveTx = await escrow.connect(signer).approveSale(home.id);
      await approveTx.wait();

      setStatusMessage("2/2: Funding remaining loan balance to Escrow...");
      const pPrice = await escrow.purchasePrice(home.id);
      const eAmount = await escrow.escrowAmount(home.id);
      const lendAmount = pPrice.sub(eAmount);

      const fundTx = await signer.sendTransaction({
        to: escrow.address,
        value: lendAmount,
        gasLimit: 100000
      });
      await fundTx.wait();

      setHasLended(true);
      setStatusMessage("✔ Loan funded & authorized by Lender!");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Lending transaction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Seller: Approve & Finalize Sale
  const sellHandler = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setStatusMessage("1/2: Submitting seller approval...");

      const signer = provider.getSigner();
      const approveTx = await escrow.connect(signer).approveSale(home.id);
      await approveTx.wait();

      setStatusMessage("2/2: Finalizing escrow sale & transferring NFT title deed...");
      const finalizeTx = await escrow.connect(signer).finalizeSale(home.id);
      await finalizeTx.wait();

      setHasSold(true);
      setIsListed(false);
      setOwner(buyer);
      setStatusMessage("🎉 Sale finalized! Title transferred to buyer and funds paid to seller!");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Finalize sale failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel Sale Handler
  const cancelHandler = async () => {
    if (!window.confirm("Are you sure you want to cancel this escrow agreement?")) return;
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setStatusMessage("Cancelling sale and executing refund according to inspection status...");

      const signer = provider.getSigner();
      const tx = await escrow.connect(signer).cancelSale(home.id);
      await tx.wait();

      setStatusMessage("Sale canceled. Contract balance refunded.");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Cancel sale failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Match roles with connected account
  const isUserBuyer = account && buyer && account.toLowerCase() === buyer.toLowerCase();
  const isUserSeller = account && seller && account.toLowerCase() === seller.toLowerCase();
  const isUserInspector = account && inspector && account.toLowerCase() === inspector.toLowerCase();
  const isUserLender = account && lender && account.toLowerCase() === lender.toLowerCase();

  const isCompleted = !isListed && owner;

  // Determine what next action is needed in the escrow pipeline
  let nextActionParty = "Buyer (Earnest Deposit)";
  if (hasBought && !hasInspected) nextActionParty = "Inspector (Inspection Approval)";
  else if (hasBought && hasInspected && !hasLended) nextActionParty = "Lender (Loan Funding)";
  else if (hasBought && hasInspected && hasLended && !hasSold) nextActionParty = "Seller (Finalize & Transfer Title)";
  else if (isCompleted) nextActionParty = "Completed";

  return (
    <div className="home-modal-backdrop" onClick={togglePop}>
      <div 
        className="home-modal-container" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-modal-title"
      >
        <button onClick={togglePop} className="home-modal-close" aria-label="Close modal">
          <img src={close} alt="Close" />
        </button>

        <div className="home-modal-body">
          {/* Left Column: Visual Gallery & Badges */}
          <div className="home-modal-gallery">
            <div className="home-modal-image-wrapper">
              <img src={home.image} alt={home.name} className="home-modal-image" />
              <div className="home-modal-image-badges">
                <span className="badge-nft">Token #{home.id}</span>
                <span className={`badge-status ${isCompleted ? 'badge-sold' : 'badge-escrow'}`}>
                  {isCompleted ? "🏆 Title Transferred" : "🔒 In Escrow Protocol"}
                </span>
              </div>
            </div>

            {/* Financial Overview Card */}
            <div className="property-financial-box">
              <div className="financial-row">
                <span className="fin-label">Purchase Price</span>
                <span className="fin-value gold-text">{purchasePriceETH || home.attributes[0]?.value} ETH</span>
              </div>
              <div className="financial-row">
                <span className="fin-label">Required Escrow Deposit</span>
                <span className="fin-value">{escrowAmountETH} ETH</span>
              </div>
              <div className="financial-row">
                <span className="fin-label">Lender Loan Commitment</span>
                <span className="fin-value">{loanAmountETH} ETH</span>
              </div>
              <div className="financial-divider"></div>
              <div className="financial-row financial-row--total">
                <span className="fin-label">Escrow Smart Contract Balance</span>
                <span className="fin-value emerald-text">{contractBalance} ETH</span>
              </div>
            </div>

            {/* Escrow Progress Stepper */}
            <div className="escrow-stepper">
              <h4 className="stepper-title">Smart Contract Escrow Pipeline</h4>
              
              <div className={`step-item ${isListed ? 'step-item--done' : 'step-item--done'}`}>
                <div className="step-circle">1</div>
                <div className="step-content">
                  <span className="step-name">Listed by Seller</span>
                  <span className="step-party">NFT Title Locked in Escrow</span>
                </div>
                <span className="step-status">✔</span>
              </div>

              <div className={`step-item ${hasBought ? 'step-item--done' : 'step-item--current'}`}>
                <div className="step-circle">2</div>
                <div className="step-content">
                  <span className="step-name">Earnest Deposit ({escrowAmountETH} ETH)</span>
                  <span className="step-party">Designated Buyer</span>
                </div>
                <span className="step-status">{hasBought ? '✔' : '⏳'}</span>
              </div>

              <div className={`step-item ${hasInspected ? 'step-item--done' : (hasBought ? 'step-item--current' : '')}`}>
                <div className="step-circle">3</div>
                <div className="step-content">
                  <span className="step-name">Physical Inspection</span>
                  <span className="step-party">Certified Inspector</span>
                </div>
                <span className="step-status">{hasInspected ? '✔' : '⏳'}</span>
              </div>

              <div className={`step-item ${hasLended ? 'step-item--done' : (hasInspected ? 'step-item--current' : '')}`}>
                <div className="step-circle">4</div>
                <div className="step-content">
                  <span className="step-name">Financing & Lending ({loanAmountETH} ETH)</span>
                  <span className="step-party">Mortgage Lender</span>
                </div>
                <span className="step-status">{hasLended ? '✔' : '⏳'}</span>
              </div>

              <div className={`step-item ${isCompleted ? 'step-item--done' : (hasLended ? 'step-item--current' : '')}`}>
                <div className="step-circle">5</div>
                <div className="step-content">
                  <span className="step-name">Finalize Sale & Title Transfer</span>
                  <span className="step-party">Seller & Contract</span>
                </div>
                <span className="step-status">{isCompleted ? '✔' : '⏳'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Information & Actions */}
          <div className="home-modal-content">
            <div className="home-modal-header">
              <span className="property-residence-type">
                {home.attributes?.find(a => a.trait_type === "Type of Residence")?.value || "Luxury Property"}
              </span>
              <h1 id="property-modal-title" className="property-title">{home.name}</h1>
              <p className="property-address">📍 {home.address}</p>

              <div className="property-key-metrics">
                <div className="metric-pill">
                  <span className="metric-icon">🛏️</span>
                  <span><strong>{home.attributes?.find(a => a.trait_type === "Bed Rooms")?.value}</strong> Beds</span>
                </div>
                <div className="metric-pill">
                  <span className="metric-icon">🚿</span>
                  <span><strong>{home.attributes?.find(a => a.trait_type === "Bathrooms")?.value}</strong> Baths</span>
                </div>
                <div className="metric-pill">
                  <span className="metric-icon">📐</span>
                  <span><strong>{home.attributes?.find(a => a.trait_type === "Square Feet")?.value}</strong> sqft</span>
                </div>
                <div className="metric-pill">
                  <span className="metric-icon">🏛️</span>
                  <span>Built <strong>{home.attributes?.find(a => a.trait_type === "Year Built")?.value}</strong></span>
                </div>
              </div>
            </div>

            {/* Notification messages */}
            {errorMessage && (
              <div className="notice-banner notice-banner--error">
                ❌ {errorMessage}
              </div>
            )}
            {statusMessage && (
              <div className="notice-banner notice-banner--success">
                {statusMessage}
              </div>
            )}

            {/* Smart Contract Interaction Controls */}
            <div className="escrow-action-panel">
              <div className="action-panel-header">
                <h3>Escrow Actions</h3>
                {!isCompleted && (
                  <span className="next-party-pill">
                    Awaiting: <strong>{nextActionParty}</strong>
                  </span>
                )}
              </div>

              {isCompleted ? (
                <div className="sold-celebration-box">
                  <span className="celebration-icon">🎉</span>
                  <div>
                    <h4>Transaction Finalized</h4>
                    <p>Official NFT Title deed successfully registered to: <code>{owner?.slice(0, 10)}...{owner?.slice(-8)}</code></p>
                  </div>
                </div>
              ) : (
                <div className="role-actions-grid">
                  {/* Buyer Action */}
                  {isUserBuyer && (
                    <div className="action-card">
                      <div className="action-card__info">
                        <strong>Buyer Action</strong>
                        <p>Deposit {escrowAmountETH} ETH earnest money and approve purchase agreement.</p>
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={buyHandler} 
                        disabled={hasBought || isProcessing}
                      >
                        {hasBought ? "✔ Deposit Locked & Approved" : (isProcessing ? "Processing..." : `Deposit ${escrowAmountETH} ETH & Approve`)}
                      </button>
                    </div>
                  )}

                  {/* Inspector Action */}
                  {isUserInspector && (
                    <div className="action-card">
                      <div className="action-card__info">
                        <strong>Inspector Action</strong>
                        <p>Certify property inspection report and update on-chain status.</p>
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={inspectHandler} 
                        disabled={hasInspected || isProcessing}
                      >
                        {hasInspected ? "✔ Inspection Approved" : (isProcessing ? "Processing..." : "Approve Inspection")}
                      </button>
                    </div>
                  )}

                  {/* Lender Action */}
                  {isUserLender && (
                    <div className="action-card">
                      <div className="action-card__info">
                        <strong>Lender Action</strong>
                        <p>Approve loan and send {loanAmountETH} ETH remaining balance into escrow.</p>
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={lendHandler} 
                        disabled={hasLended || !hasInspected || isProcessing}
                      >
                        {hasLended ? "✔ Loan Funded & Approved" : (isProcessing ? "Processing..." : `Fund ${loanAmountETH} ETH & Approve`)}
                      </button>
                      {!hasInspected && <p className="action-hint">⚠️ Requires inspection approval first</p>}
                    </div>
                  )}

                  {/* Seller Action */}
                  {isUserSeller && (
                    <div className="action-card">
                      <div className="action-card__info">
                        <strong>Seller Action</strong>
                        <p>Finalize sale: receive {purchasePriceETH} ETH total proceeds & transfer NFT deed.</p>
                      </div>
                      <button 
                        className="btn-primary btn-primary--gold" 
                        onClick={sellHandler} 
                        disabled={hasSold || !hasBought || !hasInspected || !hasLended || isProcessing}
                      >
                        {hasSold ? "✔ Sale Finalized" : (isProcessing ? "Processing..." : "Finalize Sale & Transfer Title")}
                      </button>
                      {(!hasBought || !hasInspected || !hasLended) && (
                        <p className="action-hint">⚠️ Requires Buyer earnest, Inspector pass, and Lender funding</p>
                      )}
                    </div>
                  )}

                  {/* If user does not have active role */}
                  {!isUserBuyer && !isUserInspector && !isUserLender && !isUserSeller && (
                    <div className="guest-action-box">
                      <div className="guest-action-text">
                        <h4>Explore with Simulated Accounts</h4>
                        <p>
                          You are currently connected as a viewer (<code>{account ? `${account.slice(0, 8)}...` : 'Not Connected'}</code>).
                          To test Buyer, Inspector, Lender, or Seller actions, switch accounts in the Role Testing Hub.
                        </p>
                      </div>
                      <button className="btn-secondary" onClick={onOpenRoleModal}>
                        Open Role Testing Hub
                      </button>
                    </div>
                  )}

                  {/* Cancel Sale option */}
                  {(isUserBuyer || isUserSeller) && !isCompleted && (
                    <div className="cancel-sale-row">
                      <button className="btn-text-danger" onClick={cancelHandler} disabled={isProcessing}>
                        Cancel Sale & Trigger Escrow Refund Rule
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Tabs for Details */}
            <div className="property-tabs">
              <button 
                className={`tab-btn ${activeTab === 'overview' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab-btn ${activeTab === 'features' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('features')}
              >
                Features & Specs
              </button>
              <button 
                className={`tab-btn ${activeTab === 'parties' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('parties')}
              >
                Contract Parties
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="tab-pane">
                <p className="property-description">{home.description}</p>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="tab-pane">
                <ul className="property-features-list">
                  {home.attributes?.map((attr, idx) => (
                    <li key={idx} className="feature-item">
                      <span className="feature-trait">{attr.trait_type}</span>
                      <span className="feature-value">{attr.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'parties' && (
              <div className="tab-pane">
                <div className="contract-parties-list">
                  <div className="party-row">
                    <span className="party-role">Designated Buyer:</span>
                    <code>{buyer || 'Loading...'}</code>
                  </div>
                  <div className="party-row">
                    <span className="party-role">Listing Seller:</span>
                    <code>{seller || 'Loading...'}</code>
                  </div>
                  <div className="party-row">
                    <span className="party-role">Certified Inspector:</span>
                    <code>{inspector || 'Loading...'}</code>
                  </div>
                  <div className="party-row">
                    <span className="party-role">Underwriting Lender:</span>
                    <code>{lender || 'Loading...'}</code>
                  </div>
                  <div className="party-row">
                    <span className="party-role">Escrow Smart Contract:</span>
                    <code>{escrow?.address || 'Loading...'}</code>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;