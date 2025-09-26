import React, { useState, useEffect, useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import styles from "../styles/sidebar.module.css";
import { Menu, X, Users } from "lucide-react";
import { getAllGroups,createGroups } from "../api/groups";
import { getAllFriends } from "../api/friends";
import AddGroupModal from "../components/AddGroupModal";

import { sendInvite, generateInviteLink } from "../api/invite";
import { AuthContext } from "../context/AuthContext";
const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [email, setEmail] = useState("");
  const [magicLink, setMagicLink] = useState("");
  const navigate = useNavigate();
  const { user: currentUser } = useContext(AuthContext);
    const [showAddGroup, setShowAddGroup] = useState(false);



    const fetchGroups = async () => {
      try {
        const data = await getAllGroups();
        setGroups(data.groups || []);
      } catch (err) {
        console.error("Error fetching groups:", err);
      } finally {
        setLoadingGroups(false);
      }
    };

    const fetchFriends = async () => {
      try {
        const data = await getAllFriends();
        const filtered = data.filter((f) => f._id !== currentUser._id);
        setFriends(filtered);
      } catch (err) {
        console.error("Error fetching friends:", err);
      } finally {
        setLoadingFriends(false);
      }
    };
  useEffect(() => {
    fetchGroups();
    fetchFriends();
  }, []);

  // Invite Handlers
  const handleSendInvite = async () => {
    try {
      if (!email) return alert("Please enter an email");
      await sendInvite({ email, groupId: null });
      alert("Invite sent!");
      setEmail("");
      await fetchFriends()
    } catch (err) {
      console.error(err);
      alert("Failed to send invite");
    }
  };
  const handleGenerateLink = async () => {
    try {
      const { link } = await generateInviteLink(null);
      setMagicLink(link);
    } catch (err) {
      console.error(err);
      alert("Failed to generate link");
    }
  };
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(magicLink);
      alert("Link copied to clipboard!");
    } catch {
      alert("Could not copy link");
    }
  };
    const handleAddGroup = async (groupDetails) => {
      try {
        await createGroups(groupDetails);
        setShowAddGroup(false);
        fetchGroups();
      } catch (err) {
        console.error("Error creating group:", err);
      }
    };
  return (
    <>
      {/* Mobile toggle button */}
      <button className={styles.toggleBtn} onClick={() => setOpen(!open)}>
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${open ? styles.show : ""}`}>
        <NavLink
          to="/dashboard"
          className={styles.link}
          onClick={() => setOpen(false)}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/recent"
          className={styles.link}
          onClick={() => setOpen(false)}
        >
          Recent Activity
        </NavLink>
        <NavLink
          to="/expenses"
          className={styles.link}
          onClick={() => setOpen(false)}
        >
          All Expenses
        </NavLink>

        {/* Groups Section */}
{/* Groups Section */}
<div className={styles.groupSection}>
  <h4>Groups</h4>
          <button
            className={styles.addGroupBtn}
            onClick={() => setShowAddGroup(true)}
          >
            + Add
          </button>
  {loadingGroups ? (
    <p className={styles.loading}>Loading...</p>
  ) : groups.length === 0 ? (
    <p className={styles.empty}>No groups yet</p>
  ) : (
    groups.map((g) => (
      <div
        key={g._id}
        className={styles.groupItem}
        onClick={() => {
          navigate(`/groups/${g._id}`);
          setOpen(false);
        }}
      >
        <Users size={16} className={styles.groupIcon} />
        <span>{g.name}</span>
        <small>({new Set(g.members?.map(m => m._id)).size})</small>
      </div>
    ))
  )}
</div>


        {/* Friends Section */}
        <div className={styles.groupSection}>
          <h4>Friends</h4>
          {loadingFriends ? (
            <p className={styles.loading}>Loading...</p>
          ) : friends.length === 0 ? (
            <p className={styles.empty}>No friends yet</p>
          ) : (
            friends.map((f) => (
              <div
                key={f._id}
                className={styles.groupItem}
                onClick={() => {
                  navigate(`/friends/${f._id}`);
                  setOpen(false);
                }}
              >
                <Users size={16} className={styles.groupIcon} />
                <span>{f.name}</span>
                <small>{f.email}</small>
              </div>
            ))
          )}
        </div>

        {/* Invite Section */}
        <div className={styles.groupSection}>
          <h4>Invite Friends</h4>
          <input
            type="email"
            placeholder="Enter an email address"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={styles.btn} onClick={handleSendInvite}>
            Send Invite
          </button>
          <button className={styles.btnSecondary} onClick={handleGenerateLink}>
            Generate Magic Link
          </button>

          {magicLink && (
            <div className={styles.linkBox}>
              <input
                type="text"
                value={magicLink}
                readOnly
                className={styles.input}
              />
              <button className={styles.btn} onClick={handleCopy}>
                Copy
              </button>
            </div>
          )}
        </div>
      </aside>
        {showAddGroup && (
              <AddGroupModal
                isOpen={showAddGroup}
                onClose={() => setShowAddGroup(false)}
                onGroupAdded={handleAddGroup}
              />
            )}
    </>
  );
};

export default Sidebar;
