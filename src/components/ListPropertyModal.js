import React, { useState } from 'react';
import { ethers } from 'ethers';

const PRESET_IMAGES = [
  { label: "Modern Villa", url: "/images/2.jpg" },
  { label: "Coastal Sanctuary", url: "/images/3.jpg" },
  { label: "Biscayne Bay Villa", url: "/images/4.jpg" },
  { label: "Skyline Penthouse", url: "/images/1.jpg" }
];

const ListPropertyModal = ({ isOpen, onClose, realEstate, escrow, provider, account, roles, onPropertyAdded }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('18');
  const [escrowDeposit, setEscrowDeposit] = useState('5');
  const [image, setImage] = useState(PRESET_IMAGES[0].url);
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('3');
  const [sqft, setSqft] = useState('3200');
  const [residenceType, setResidenceType] = useState('Single family residence');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const isSeller = account && roles && roles.seller && account.toLowerCase() === roles.seller.toLowerCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!account) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }

    if (!isSeller) {
      setErrorMessage("Only the authorized Seller account can mint and list properties.");
      return;
    }

    try {
      setIsLoading(true);
      const signer = provider.getSigner();

      // 1. Create simulated metadata
      const newPropertyMetadata = {
        name,
        address,
        description,
        image,
        attributes: [
          { trait_type: "Purchase Price", value: parseFloat(price) },
          { trait_type: "Type of Residence", value: residenceType },
          { trait_type: "Bed Rooms", value: parseInt(bedrooms) },
          { trait_type: "Bathrooms", value: parseInt(bathrooms) },
          { trait_type: "Square Feet", value: parseInt(sqft) },
          { trait_type: "Year Built", value: new Date().getFullYear() }
        ]
      };

      // 2. Mint NFT
      setStatusMessage("Step 1/3: Minting Property NFT on blockchain...");
      // In a production app this would upload to IPFS. Here we encode or use public metadata
      const tokenUri = `data:application/json;base64,${btoa(JSON.stringify(newPropertyMetadata))}`;
      const mintTx = await realEstate.connect(signer).mint(tokenUri);
      await mintTx.wait();

      const totalSupply = await realEstate.totalSupply();
      const newItemId = totalSupply.toNumber();

      // 3. Approve Escrow
      setStatusMessage(`Step 2/3: Approving Escrow contract for Token #${newItemId}...`);
      const approveTx = await realEstate.connect(signer).approve(escrow.address, newItemId);
      await approveTx.wait();

      // 4. List in Escrow
      setStatusMessage(`Step 3/3: Listing Token #${newItemId} on Escrow...`);
      const buyerAddress = roles.buyer || account;
      const purchasePriceWei = ethers.utils.parseEther(price.toString());
      const escrowAmountWei = ethers.utils.parseEther(escrowDeposit.toString());

      const listTx = await escrow.connect(signer).list(newItemId, buyerAddress, purchasePriceWei, escrowAmountWei);
      await listTx.wait();

      setStatusMessage("🎉 Property successfully minted & listed!");
      setTimeout(() => {
        setIsLoading(false);
        if (onPropertyAdded) onPropertyAdded();
        onClose();
      }, 1500);

    } catch (err) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Transaction failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__container list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title-group">
            <span className="modal__badge">Marketplace Management</span>
            <h2>List New Property</h2>
            <p>Mint a real estate title as an ERC-721 NFT and initialize its escrow agreement.</p>
          </div>
          <button className="modal__close-btn" onClick={onClose} aria-label="Close modal">×</button>
        </div>

        {!isSeller && (
          <div className="notice-banner notice-banner--warning">
            ⚠️ <strong>Seller Role Required:</strong> The active account is not the designated Seller (Account #1). Switch to the Seller account via the Role Testing Hub to list properties.
          </div>
        )}

        {errorMessage && (
          <div className="notice-banner notice-banner--error">
            ❌ {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div className="notice-banner notice-banner--success">
            ⏳ {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="list-form">
          <div className="form-group">
            <label>Property Name / Headline</label>
            <input 
              type="text" 
              placeholder="e.g. Bel-Air Glass Villa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Physical Address</label>
            <input 
              type="text" 
              placeholder="e.g. 10480 Bellagio Rd, Los Angeles, CA 90077"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Price (ETH)</label>
              <input 
                type="number" 
                step="0.1"
                min="0.1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Escrow Deposit (ETH)</label>
              <input 
                type="number" 
                step="0.1"
                min="0.1"
                value={escrowDeposit}
                onChange={(e) => setEscrowDeposit(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row form-row--three">
            <div className="form-group">
              <label>Bedrooms</label>
              <input 
                type="number" 
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Bathrooms</label>
              <input 
                type="number" 
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Square Feet</label>
              <input 
                type="number" 
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Residence Type</label>
            <select value={residenceType} onChange={(e) => setResidenceType(e.target.value)}>
              <option value="Condo">Condo</option>
              <option value="Single family residence">Single Family Residence</option>
              <option value="Coastal Residence">Coastal Residence</option>
              <option value="Waterfront Villa">Waterfront Villa</option>
            </select>
          </div>

          <div className="form-group">
            <label>Property Photo</label>
            <div className="preset-images-picker">
              {PRESET_IMAGES.map((preset, idx) => (
                <div 
                  key={idx} 
                  className={`preset-thumb ${image === preset.url ? 'preset-thumb--active' : ''}`}
                  onClick={() => setImage(preset.url)}
                >
                  <img src={preset.url} alt={preset.label} />
                  <span>{preset.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              rows="3"
              placeholder="Provide an overview of the architectural highlights, amenities, and location..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading || !isSeller}>
              {isLoading ? "Processing Blockchain Transaction..." : "Mint & List on Escrow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ListPropertyModal;
