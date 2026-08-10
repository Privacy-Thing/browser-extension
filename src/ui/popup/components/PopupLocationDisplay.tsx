type LocationDisplayProps = {
  location?: string;
  locationTitle?: string;
  eyebrow?: string;
};

export const PopupLocationDisplay = ({
  location,
  locationTitle,
  eyebrow,
}: LocationDisplayProps) => {
  if (!location) {
    return null;
  }

  return (
    <div className="gw-popup-profile-block">
      {eyebrow ? <p className="gw-popup-profile-eyebrow">{eyebrow}</p> : null}
      <p id="current-profile" title={locationTitle} className="gw-popup-profile-name">
        {location}
      </p>
    </div>
  );
};
