import { useState, useRef } from "react";
import styles from "../styles/settleUpModal.module.css";

const SettleUpModal = ({
  isOpen,
  onClose,
  onConfirm,
  onConfirmSettlement,
  settlementData
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const modalRef = useRef(null);

  if (!isOpen || !settlementData) return null;

  const {
    fromUser,
    toUser,
    amount,
    groupId,
    groupName,
    type = "friend" // "friend", "group", "expense"
  } = settlementData;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const confirmHandler = onConfirm || onConfirmSettlement;
    if (!confirmHandler) {
      console.error("No confirmation handler provided");
      alert("Configuration error. Please refresh and try again.");
      return;
    }

    if (!fromUser || !toUser || !amount) {
      console.error("Missing required settlement data:", { fromUser, toUser, amount });
      alert("Missing settlement information. Please try again.");
      return;
    }

    setIsProcessing(true);
    try {
      await confirmHandler({ fromUser, toUser, amount, groupId, type }); // <-- pass data
      onClose();
    } catch (error) {
      console.error("Settlement failed:", error);
      alert("Failed to record settlement. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };


  const formatAmount = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amt);
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
          onClose && onClose();
        }
      }}
    >
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          <h3>Settle Up</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.settlementInfo}>
            <div className={styles.paymentDetails}>
              <div className={styles.paymentFlow}>
                <div className={styles.userBox}>
                  <span className={styles.userName}>{fromUser?.name}</span>
                  <span className={styles.userLabel}>pays</span>
                </div>
                <div className={styles.transferCol}>
                  <span className={styles.amountPill}>{formatAmount(amount)}</span>
                  <div className={styles.arrow}>→</div>
                </div>
                <div className={styles.userBox}>
                  <span className={styles.userName}>{toUser?.name}</span>
                  <span className={styles.userLabel}>receives</span>
                </div>
              </div>
            </div>
            {/* Optional compact context line */}
            {groupName && (
              <div className={styles.contextMini}>in {`"${groupName}"`}</div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={isProcessing || !amount || amount <= 0}
          >
            {isProcessing ? "Recording..." : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettleUpModal;