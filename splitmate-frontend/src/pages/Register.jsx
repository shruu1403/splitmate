import React, { useState,useEffect,useContext } from "react";
import { registerUser } from "../api/auth";
import { useNavigate } from "react-router-dom";
import styles from "../styles/register.module.css";
import googleLogo from "../assets/images/google-logo.png";
import { AuthContext } from "../context/AuthContext";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const {login}= useContext(AuthContext)

  const navigate = useNavigate();

  useEffect(() => {
  const handleMessage = (event) => {
    // only accept from your backend
    if (event.origin !== "http://localhost:8080") return;

    if (event.data.token) {
      // save token and login
      // localStorage.setItem("token", event.data.token);
      login(event.data.token); // from AuthContext
      navigate("/dashboard"); // redirect to dashboard
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}, [login,navigate]);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await registerUser(formData);

      if (res.msg === "user has been registered successfully") {
        alert("Registration successful!");
        navigate("/login"); // redirect to login
      } else {
        setError(res.msg || "Registration failed");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.open(
      "http://localhost:8080/api/auth/google",
      "_blank",
      "width=500,height=600"
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Create Account</h2>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            name="name"
            placeholder="Name"
            onChange={handleChange}
            className={styles.inputField}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            onChange={handleChange}
            className={styles.inputField}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
            className={styles.inputField}
            required
          />

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className={styles.orContainer}>
          <hr />
          <span>or</span>
          <hr />
        </div>

        <button onClick={handleGoogleSignup} className={styles.googleBtn}>
          <img src={googleLogo} alt="Google" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Register;
