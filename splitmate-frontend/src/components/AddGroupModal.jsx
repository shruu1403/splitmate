import { useState, useEffect, useContext, useRef } from "react";
import { getAllFriends } from "../api/friends";
import { createGroups } from "../api/groups";
import { sendInvite } from "../api/invite";
import styles from "../styles/addGroupModal.module.css";
import { AuthContext } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";

export default function AddGroupModal({ isOpen, onClose, onGroupAdded }) {
  const formRef = useRef(null);
  const modalRef = useRef(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [sendInvitesOnSave, setSendInvitesOnSave] = useState(true);
  const [alsoAddToFriends, setAlsoAddToFriends] = useState(false);
  const [toast, setToast] = useState("");

  const { user } = useContext(AuthContext);
  const { reloadGroups } = useGroups();

  // Pre-fill creator when modal opens
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    if (isOpen && user && members.length === 0) {
      setMembers([
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          locked: true, // creator row
        },
      ]);
    }
  }, [isOpen, user]);

  const handleChange = async (index, value) => {
    setActiveIndex(index);

    // Persist the typed value into the row (treat as email input)
    setMembers(prev => {
      const updated = [...prev];
      const row = { ...(updated[index] || {}) };
      row.email = value;
      updated[index] = row;
      return updated;
    });

    if (value.length > 0) {
      try {
        const results = await getAllFriends(value);
        // Filter out already selected friends
        const selectedIds = members.map((m) => m._id);
        setSuggestions(results.filter((r) => !selectedIds.includes(r._id)));
      } catch (err) {
        console.error(err);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectFriend = (index, friend) => {
    const updated = [...members];
    updated[index] = { ...friend, locked: false };
    setMembers(updated);
    setSuggestions([]);
    setActiveIndex(null);
  };

  const addMemberField = () =>
    setMembers([...members, { name: "", email: "" }]);

  const removeMemberField = (i) =>
    setMembers(members.filter((_, idx) => idx !== i));

  // per-row invite sender was removed in favor of invite-on-save flow

  const handleSubmit = async (e) => {
    e.preventDefault();
    
  // Validate group has at least 2 members (creator + 1 other)
    // Accept either an existing friend (has _id) OR a typed email as an intended member
    const hasExistingFriend = members.some(m => !m.locked && m._id);
    const hasTypedEmail = members.some(m => !m.locked && !m._id && m.email && m.email.includes("@"));
    if (!hasExistingFriend && !hasTypedEmail) {
      setToast("Add at least one more member");
      setTimeout(() => setToast("") , 1600);
      return;
    }
    
    try {
      // exclude creator before sending
      const filteredMembers = members
        .filter((m) => !m.locked) // skip the pre-filled creator row
        .map((m) => m._id);
      const response = await createGroups({
        name,
        // Send only valid friend IDs; emails are for invite flow post-save
        members: filteredMembers.filter(Boolean), // backend auto-includes creator
      });
      
      const newGroup = response.group || response;
      reloadGroups();

      // Collect typed emails that are not existing friends (no _id)
      const inviteEmails = Array.from(
        new Set(
          members
            .filter(m => !m.locked && !m._id && m.email && m.email.includes("@"))
            .map(m => m.email.trim().toLowerCase())
        )
      );

      // Optionally send invites for the newly created group (single email),
      // and if alsoAddToFriends is checked, backend will auto-add friendship on accept
      if (sendInvitesOnSave && newGroup && inviteEmails.length > 0) {
        let success = 0;
        let failed = 0;
        for (const email of inviteEmails) {
          try {
            await sendInvite({ email, groupId: newGroup._id, alsoAddToFriends });
            success++;
          } catch (err) {
            console.error("Failed to send invite to", email, err);
            failed++;
          }
        }
        if (success > 0 || failed > 0) {
          const parts = [];
          if (success > 0) parts.push(`${success} sent`);
          if (failed > 0) parts.push(`${failed} failed`);
          setToast(`Invites: ${parts.join(", ")}.`);
          setTimeout(() => setToast("") , 1600);
        }
      }

      // Call the callback with the new group data if provided
      if (onGroupAdded && newGroup) {
        onGroupAdded(newGroup);
      }

      // reset state
      setName("");
      setMembers([
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          locked: true,
        },
      ]);
      setSendInvitesOnSave(true);
      setAlsoAddToFriends(false);
      setToast("Group created successfully");
      setTimeout(() => {
        setToast("");
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Error creating group:", err);
      setToast("Could not create group. Try again.");
      setTimeout(() => setToast("") , 1600);
    }
  };

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const tag = e.target.tagName;
      const type = e.target.type;
      if (tag === 'TEXTAREA') return; // don't submit on multiline inputs
      if (tag === 'BUTTON' && type !== 'submit') return; // don't override non-submit buttons
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
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
      <div className={styles.modal} onKeyDown={handleKeyDown} ref={modalRef}>
        <button
          type="button"
          aria-label="Close modal"
          className={styles.closeModalBtn}
          onClick={onClose}
        >
          ×
        </button>
        <form ref={formRef} onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.header}>
          <h2 className={styles.title}>Create Group</h2></div>
          <div className={styles.divider} />
          

          <label>
            <h3>Group Name</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              autoFocus
              required
            />
          </label>

          <h3 className={styles.sectionHeading}>Group Members:</h3>
          {members.map((m, i) => (
            <div key={i} className={styles.memberRow}>
              <div style={{ position: "relative", flex: 1 }}>
                {m._id ? (
                  // Selected friend -> show as chip
                  <div className={`${styles.chip} ${m.locked ? styles.chipLocked : ''}`}>
                    <span className={styles.chipText}>{m.name}</span>
                    {/* {m.locked && <span className={styles.youBadge}>You</span>} */}
                    {!m.locked && (
                      <button type="button" className={styles.chipRemove} onClick={() => removeMemberField(i)} title="Remove">
                        ×
                      </button>
                    )}
                  </div>
                ) : (
                  // Typing to search
                  <input
                    value={m.email || ""}
                    onChange={(e) => handleChange(i, e.target.value)}
                    placeholder="Type a name or email"
                  />
                )}

                {/* Suggestions dropdown (per row) */}
                {activeIndex === i && suggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {suggestions.map((s) => (
                      <div key={s._id} onClick={() => handleSelectFriend(i, s)}>
                        {s.name} ({s.email})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!m.locked && !m._id && (
                <div className={styles.rowActions}>
                  <button type="button" className={styles.rowRemove} onClick={() => removeMemberField(i)} title="Remove">
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}

          <button type="button" onClick={addMemberField} className={styles.addMemberBtn}>
            + Add Member
          </button>
           <p className={styles.hint}>Tip: Type an email if the person isn’t on your friends list.</p>

          <div className={styles.inviteOptions}>
            <h4>Invite Options</h4>
            <div className={styles.inviteChecks}>
              <label className={styles.checkboxLabel} title="We’ll email typed addresses a group invite after creation">
                <input
                  type="checkbox"
                  checked={sendInvitesOnSave}
                  onChange={(e) => setSendInvitesOnSave(e.target.checked)}
                />
                <span>Send invite on Save</span>
              </label>
              <label className={styles.checkboxLabel} title="If they’re not friends yet, also send a friend request">
                <input
                  type="checkbox"
                  checked={alsoAddToFriends}
                  onChange={(e) => setAlsoAddToFriends(e.target.checked)}
                />
                <span>Also add to Friends</span>
              </label>
            </div>
            {/* <p className={styles.hint}>Tip: Type an email if the person isn’t on your friends list.</p> */}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary}> Save</button>
            <button type="button" onClick={onClose} className={styles.btnOutline}>
              Cancel
            </button>
          </div>
        </form>
        {toast && <div className={styles.modalToast} role="status" aria-live="polite">{toast}</div>}
      </div>
    </div>
  );
}
