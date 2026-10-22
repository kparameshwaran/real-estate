import React from 'react';

const PROPERTY_TYPES = [
  "All Types",
  "Condo",
  "Single family residence",
  "Coastal Residence",
  "Waterfront Villa"
];

const Search = ({ 
  searchTerm, 
  setSearchTerm, 
  selectedType, 
  setSelectedType, 
  maxPrice, 
  setMaxPrice, 
  sortBy, 
  setSortBy,
  propertyCount,
  onOpenListModal
}) => {
  return (
    <header className="hero-section">
      <div className="hero-section__overlay"></div>
      <div className="hero-section__content">
        <div className="hero-section__badge">
          <span className="badge-pulse"></span>
          <span>Next-Gen Decentralized Escrow Protocol</span>
        </div>

        <h1 className="hero-section__title">
          Acquire Prime Real Estate <br />
          <span className="gradient-text">Fully Secured by Smart Contracts</span>
        </h1>

        <p className="hero-section__subtitle">
          Transparent, peer-to-peer real estate acquisition. From earnest deposit to automated title deed transfer—eliminate intermediaries with on-chain cryptographic escrow.
        </p>

        <div className="hero-search-bar">
          <div className="hero-search-bar__input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="hero-search-bar__input"
              placeholder="Search by city, address, penthouse, villa, or landmark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="search-clear-btn" 
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="hero-filters-row">
            <div className="filter-item">
              <label>Property Type</label>
              <select 
                value={selectedType} 
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {PROPERTY_TYPES.map((type, idx) => (
                  <option key={idx} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>Max Price ({maxPrice} ETH)</label>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="price-slider"
              />
            </div>

            <div className="filter-item">
              <label>Sort By</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="featured">Featured Collection</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="sqft-desc">Largest Area (sqft)</option>
              </select>
            </div>

            <button 
              className="list-property-trigger-btn"
              onClick={onOpenListModal}
              title="Mint and list a new property"
            >
              <span>+ List Property</span>
            </button>
          </div>
        </div>

        <div className="hero-stats-row">
          <div className="hero-stat">
            <span className="hero-stat__number">{propertyCount}</span>
            <span className="hero-stat__label">Verified On-Chain Titles</span>
          </div>
          <div className="hero-stat__divider"></div>
          <div className="hero-stat">
            <span className="hero-stat__number">0%</span>
            <span className="hero-stat__label">Broker Commission</span>
          </div>
          <div className="hero-stat__divider"></div>
          <div className="hero-stat">
            <span className="hero-stat__number">100%</span>
            <span className="hero-stat__label">Immutable Escrow Security</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Search;