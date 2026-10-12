
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import api from "./api.js";

const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const initialAuth = {
  name: "",
  email: "",
  password: "",
  role: "both",
  bloodGroup: "O+",
  city: "",
  phone: "",
  locationConsent: false,
};

const initialRequest = {
  bloodGroup: "O+",
  units: 1,
  hospital: "",
  hospitalAddress: "",
  city: "",
  notes: "",
};

export default function App() {
  const [mode, setMode] = useState("register");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState(initialAuth);
  const [request, setRequest] = useState(initialRequest);
  const [busy, setBusy] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState({});

  async function loadRequests() {
    try {
      const { data } = await api.get("/requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Could not load requests. Check the API connection."
      );
    }
  }

  async function loadNotifications() {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.notifications || []);
    } catch {
      // Keep the rest of the page available if notifications fail.
    }
  }

  async function openRequestDetails(id) {
    const existing = requests.find((item) => item._id === id);

    setSelectedRequest(existing || { _id: id });

    try {
      const { data } = await api.get(`/requests/${id}`);
      const details = data.request || data;

      setRequestDetails((old) => ({
        ...old,
        [id]: details,
      }));

      setSelectedRequest(details);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Could not load the full request details."
      );
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    loadNotifications();

    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
      {
        auth: {
          token: localStorage.getItem("bloodlink_token"),
        },
      }
    );

    socket.on("notification:new", (notification) => {
      setNotifications((old) =>
        [notification, ...old].slice(0, 20)
      );

      setMessage(
        `${notification.title}: ${notification.message}`
      );

      loadRequests();
    });

    return () => socket.disconnect();
  }, [user]);

  function updateForm(e) {
    const { name, value, checked, type } = e.target;

    setForm((old) => ({
      ...old,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function updateRequest(e) {
    setRequest((old) => ({
      ...old,
      [e.target.name]: e.target.value,
    }));
  }

  async function submitAuth(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const endpoint =
        mode === "register" ? "/auth/register" : "/auth/login";

      const payload =
        mode === "register"
          ? form
          : {
              email: form.email,
              password: form.password,
            };

      const { data } = await api.post(endpoint, payload);

      localStorage.setItem("bloodlink_token", data.token);
      setUser(data.user);
      setMessage(
        `Welcome${data.user.name ? `, ${data.user.name}` : ""}!`
      );

      await loadRequests();
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Unable to sign in. Check your details and API connection."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(e) {
    e.preventDefault();

    if (!user) {
      setMessage("Please sign in before posting a blood request.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data } = await api.post("/requests", {
        ...request,
        units: Number(request.units),
      });

      setMessage(
        `Request posted. ${data.potentialDonorsNotified ?? 0} potential donor(s) notified.`
      );

      setRequest(initialRequest);
      await loadRequests();
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Could not post the request."
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(e) {
    try {
      const { data } = await api.patch("/donors/availability", {
        available: e.target.checked,
      });

      setUser((old) => ({
        ...old,
        available: data.available,
      }));

      setMessage(
        `Availability set to ${
          data.available ? "available" : "unavailable"
        }.`
      );
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Complete your donor profile first."
      );
    }
  }

  async function refreshAfterAction(id) {
    await loadRequests();
    await loadNotifications();

    if (id) {
      try {
        const { data } = await api.get(`/requests/${id}`);
        const details = data.request || data;

        setRequestDetails((old) => ({
          ...old,
          [id]: details,
        }));

        setSelectedRequest(details);
      } catch {
        // The list is still refreshed even if details cannot be loaded.
      }
    }
  }

  async function acceptRequest(id) {
    setBusy(true);
    setMessage("");

    try {
      const { data } = await api.post(`/requests/${id}/accept`);

      setMessage(
        data.message ||
          "Request matched. Open the details to view available contact information."
      );

      await refreshAfterAction(id);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Could not accept this request."
      );
    } finally {
      setBusy(false);
    }
  }

  async function markFulfilled(id) {
    const confirmed = window.confirm(
      "Confirm that this request has been completed after coordinating with the donor and hospital?"
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      const { data } = await api.post(`/requests/${id}/fulfill`);

      setMessage(data.message || "Request marked fulfilled.");
      await refreshAfterAction(id);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Could not update the request."
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest(id) {
    if (!window.confirm("Cancel this blood request?")) return;

    setBusy(true);

    try {
      await api.post(`/requests/${id}/cancel`);

      setMessage("Request cancelled.");
      await refreshAfterAction(id);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Could not cancel this request."
      );
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("bloodlink_token");
    setUser(null);
    setNotifications([]);
    setSelectedRequest(null);
    setRequestDetails({});
    setMessage("You have signed out.");
  }

  function whatsappUrl(phone) {
    let digits = String(phone || "").replace(/\D/g, "");

    if (digits.length === 10) digits = `91${digits}`;

    return `https://wa.me/${digits}`;
  }

  function renderContact(person, label) {
    if (!person) {
      return (
        <div className="contact-person">
          <strong>{label}</strong>
          <p>Contact information is not available.</p>
        </div>
      );
    }

    return (
      <div className="contact-person">
        <strong>{label}</strong>
        <p>{person.name || label}</p>

        {person.phone && (
          <>
            <a href={`tel:${person.phone}`}>
              Call: {person.phone}
            </a>

            <a
              href={whatsappUrl(person.phone)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp ↗
            </a>
          </>
        )}

        {person.email && (
          <a href={`mailto:${person.email}`}>
            Email: {person.email}
          </a>
        )}

        {!person.phone && !person.email && (
          <p>No phone number or email was provided.</p>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="nav">
        <a className="brand" href="#">
          <span className="brand-icon">♥</span> BloodLink
        </a>

        <div className="nav-right">
          {user ? (
            <>
              <span className="welcome">Hi, {user.name}</span>
              <button
                type="button"
                className="button secondary small"
                onClick={logout}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button secondary small"
              onClick={() =>
                setMode((old) =>
                  old === "register" ? "login" : "register"
                )
              }
            >
              {mode === "register" ? "Sign in" : "Create account"}
            </button>
          )}
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="pulse"></span>
              COMMUNITY-POWERED DONOR NETWORK
            </span>

            <h1>
              One connection.
              <br />
              <span>One chance at life.</span>
            </h1>

            <p>
              Help connect people who need blood with potential donors
              in their community. Every willing donor can make a
              difference.
            </p>

            <div className="hero-actions">
              <a className="button primary" href="#request">
                Request blood ↗
              </a>
              <a className="button outline" href="#join">
                Become a donor
              </a>
            </div>

            <div className="trust-note">
              ✦ Built around consent, care, and community
            </div>
          </div>

          <div className="hero-art">
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="drop">
              <span>♥</span>
            </div>

            <div className="float-card card-top">
              <span className="mini-icon">+</span>
              <div>
                <b>Give hope</b>
                <small>Be there when it matters</small>
              </div>
            </div>

            <div className="float-card card-bottom">
              <span className="avatar">♥</span>
              <div>
                <b>Local connections</b>
                <small>People helping people</small>
              </div>
              <span className="status-dot"></span>
            </div>
          </div>
        </section>

        <section className="stats">
          <div>
            <strong>8</strong>
            <span>Blood groups</span>
          </div>
          <div>
            <strong>1 goal</strong>
            <span>Help each other</span>
          </div>
          <div>
            <strong>Community</strong>
            <span>Powered by people</span>
          </div>
        </section>

        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}

        <section className="section" id="join">
          <div className="section-heading">
            <span className="eyebrow">GET STARTED</span>
            <h2>
              {user
                ? "Your BloodLink space"
                : mode === "register"
                  ? "Join the donor community"
                  : "Welcome back"}
            </h2>
            <p>
              A few details help people find potential donors in their
              city.
            </p>
          </div>

          {user ? (
            <div className="panel signed-in">
              <div>
                <h3>You're signed in, {user.name}.</h3>
                <p>
                  Only mark yourself available when you are genuinely
                  willing to be contacted.
                </p>

                {notifications.length > 0 && (
                  <p>
                    <b>Recent notifications:</b>{" "}
                    {notifications
                      .slice(0, 3)
                      .map((n) => n.title)
                      .join(" · ")}
                  </p>
                )}
              </div>

              {["donor", "both"].includes(user.role) && (
                <label className="availability">
                  <input
                    type="checkbox"
                    checked={Boolean(user.available)}
                    onChange={toggleAvailability}
                  />
                  Available to be contacted
                </label>
              )}
            </div>
          ) : (
            <form className="panel form-grid" onSubmit={submitAuth}>
              {mode === "register" && (
                <label>
                  Full name
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateForm}
                    required
                    minLength="2"
                    maxLength="80"
                    placeholder="Your name"
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateForm}
                  required
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={mode === "register" ? 10 : 1}
                  maxLength="128"
                  value={form.password}
                  onChange={updateForm}
                  required
                  placeholder={
                    mode === "register"
                      ? "At least 10 characters"
                      : "Your password"
                  }
                />
              </label>

              {mode === "register" && (
                <>
                  <label>
                    I'm joining as
                    <select
                      name="role"
                      value={form.role}
                      onChange={updateForm}
                    >
                      <option value="both">Donor and requester</option>
                      <option value="donor">Donor</option>
                      <option value="requester">Requester</option>
                    </select>
                  </label>

                  <label>
                    Blood group
                    <select
                      name="bloodGroup"
                      value={form.bloodGroup}
                      onChange={updateForm}
                    >
                      {groups.map((group) => (
                        <option key={group}>{group}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    City
                    <input
                      name="city"
                      value={form.city}
                      onChange={updateForm}
                      maxLength="100"
                      placeholder="e.g. Lucknow"
                    />
                  </label>

                  <label>
                    Phone (optional)
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={updateForm}
                      maxLength="30"
                      placeholder="Contact number"
                    />
                  </label>

                  <label className="consent span-two">
                    <input
                      name="locationConsent"
                      type="checkbox"
                      checked={form.locationConsent}
                      onChange={updateForm}
                    />
                    I consent to location-based matching if I provide
                    coordinates later. Coordinates are not collected by
                    this form.
                  </label>
                </>
              )}

              <div className="form-footer">
                <p>
                  Use BloodLink respectfully. Do not post patient
                  diagnoses or unnecessary sensitive details.
                </p>

                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? "Please wait…"
                    : mode === "register"
                      ? "Create account →"
                      : "Sign in →"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="section request-section" id="request">
          <div className="section-heading">
            <span className="eyebrow">ASK FOR HELP</span>
            <h2>Post a blood request</h2>
            <p>
              Share the hospital and city so potential donors can see
              the request.
            </p>
          </div>

          <form className="panel form-grid" onSubmit={submitRequest}>
            <label>
              Blood group needed
              <select
                name="bloodGroup"
                value={request.bloodGroup}
                onChange={updateRequest}
              >
                {groups.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </label>

            <label>
              Units requested
              <input
                name="units"
                type="number"
                min="1"
                max="10"
                value={request.units}
                onChange={updateRequest}
                required
              />
            </label>

            <label className="span-two">
              Hospital / blood bank
              <input
                name="hospital"
                value={request.hospital}
                onChange={updateRequest}
                required
                minLength="2"
                maxLength="180"
                placeholder="Hospital name"
              />
            </label>

            <label className="span-two">
              Hospital full address (optional)
              <input
                name="hospitalAddress"
                value={request.hospitalAddress}
                onChange={updateRequest}
                maxLength="300"
                placeholder="Area, road, landmark, or hospital address"
              />
            </label>

            <label>
              City
              <input
                name="city"
                value={request.city}
                onChange={updateRequest}
                required
                minLength="2"
                maxLength="100"
                placeholder="City"
              />
            </label>

            <label>
              Additional information (optional)
              <input
                name="notes"
                value={request.notes}
                onChange={updateRequest}
                maxLength="500"
                placeholder="Do not include sensitive patient details"
              />
            </label>

            <div className="form-footer">
              <p>
                For urgent needs, contact the hospital or blood bank
                directly. Posting does not guarantee a donor.
              </p>

              <button
                className="button primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Please wait…" : "Post request →"}
              </button>
            </div>
          </form>
        </section>

        <section className="section listings">
          <div className="section-heading row-heading">
            <div>
              <span className="eyebrow">COMMUNITY BOARD</span>
              <h2>Recent requests</h2>
            </div>

            <button
              type="button"
              className="button secondary small"
              onClick={loadRequests}
            >
              ↻ Refresh
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="empty panel">
              <span>♡</span>
              <h3>No requests yet</h3>
              <p>New community requests will appear here.</p>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((r) => {
                const details = requestDetails[r._id] || r;
                const status = details.status || r.status;
                const isRequester =
                  details.viewer?.isRequester === true ||
                  r.viewer?.isRequester === true;
                const isParticipant =
                  details.viewer?.isParticipant === true ||
                  r.viewer?.isParticipant === true;

                return (
                  <article className="request-card" key={r._id}>
                    <div className="blood-badge">{r.bloodGroup}</div>

                    <div className="request-info">
                      <h3>{r.hospital}</h3>
                      <p>
                        {r.city} · {r.units} unit
                        {r.units > 1 ? "s" : ""}
                      </p>

                      {r.hospitalAddress && (
                        <p>
                          <strong>Address:</strong> {r.hospitalAddress}
                        </p>
                      )}

                      {r.notes && (
                        <p>
                          <strong>Details:</strong> {r.notes}
                        </p>
                      )}

                      <small>
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : ""}
                      </small>
                    </div>

                    <span className={`tag ${status}`}>
                      {status === "accepted" ? "Matched" : status}
                    </span>

                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => openRequestDetails(r._id)}
                    >
                      View full details
                    </button>

                    {user &&
                      ["donor", "both"].includes(user.role) &&
                      status === "open" &&
                      !isRequester && (
                        <button
                          type="button"
                          className="button primary small"
                          disabled={busy}
                          onClick={() => acceptRequest(r._id)}
                        >
                          Accept request
                        </button>
                      )}

                    {user &&
                      isRequester &&
                      status === "accepted" && (
                        <button
                          type="button"
                          className="button secondary small"
                          disabled={busy}
                          onClick={() => markFulfilled(r._id)}
                        >
                          Confirm completed
                        </button>
                      )}

                    {user &&
                      isRequester &&
                      ["open", "accepted"].includes(status) && (
                        <button
                          type="button"
                          className="button secondary small"
                          disabled={busy}
                          onClick={() => cancelRequest(r._id)}
                        >
                          Cancel request
                        </button>
                      )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {selectedRequest && (
          <section className="section" id="selected-request">
            <div className="panel request-details">
              <div className="section-heading row-heading">
                <div>
                  <span className="eyebrow">REQUEST INFORMATION</span>
                  <h2>Full request details</h2>
                </div>

                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => setSelectedRequest(null)}
                >
                  Close
                </button>
              </div>

              {(() => {
                const id = selectedRequest._id;
                const details =
                  requestDetails[id] || selectedRequest;

                return (
                  <>
                    <h3>{details.hospital || "Hospital not provided"}</h3>
                    <p>
                      <strong>Hospital address:</strong>{" "}
                      {details.hospitalAddress || "Not provided"}
                    </p>
                    <p>
                      <strong>City:</strong> {details.city || "Not provided"}
                    </p>
                    <p>
                      <strong>Blood group:</strong>{" "}
                      {details.bloodGroup || "Not provided"}
                    </p>
                    <p>
                      <strong>Units:</strong> {details.units ?? "Not provided"}
                    </p>
                    <p>
                      <strong>Additional information:</strong>{" "}
                      {details.notes || "None provided"}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {details.status === "accepted"
                        ? "Matched"
                        : details.status}
                    </p>

                    {details.contacts &&
                      details.viewer?.isParticipant && (
                        <>
                          <h3>Matched contact information</h3>
                          <div className="contact-grid">
                            {renderContact(
                              details.contacts.requester,
                              "Requester"
                            )}
                            {renderContact(
                              details.contacts.donor,
                              "Matched donor"
                            )}
                          </div>
                        </>
                      )}

                    {details.status === "accepted" &&
                      !details.contacts && (
                        <p className="contact-note">
                          This request is matched, but contact information
                          was not returned by the server. Check the backend
                          authorization and contact serialization.
                        </p>
                      )}

                    {details.status === "open" && (
                      <p className="contact-note">
                        Contact details become available to the requester
                        and matched donor after acceptance.
                      </p>
                    )}

                    {user &&
                      details.viewer?.isRequester &&
                      details.status === "accepted" && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy}
                          onClick={() => markFulfilled(id)}
                        >
                          Confirm completed
                        </button>
                      )}
                  </>
                );
              })()}

              <p className="contact-note">
                Confirm arrangements directly with the hospital or blood
                bank. BloodLink does not verify medical compatibility.
              </p>
            </div>
          </section>
        )}

        <section className="safety">
          <span className="safety-icon">✚</span>
          <div>
            <h3>Care first. Always.</h3>
            <p>
              BloodLink is a community connection tool, not a medical
              service. A licensed hospital or blood bank must verify donor
              eligibility, testing, compatibility, and arrangements. Never
              delay emergency care while waiting for a response.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#">
          <span className="brand-icon">♥</span> BloodLink
        </a>
        <span>Connecting communities with care.</span>
        <span>© {new Date().getFullYear()} BloodLink</span>
      </footer>
    </div>
  );
}
