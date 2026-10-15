/* Contractor/tender marketplace module for apexpave ai. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // Always target the Python backend directly (works on port 8000 & avoids Vite proxy)
  const API_BASE = window.location.port === '5173'
    ? 'http://127.0.0.1:8000'
    : '';

  const status = (message, error = false) => {
    const el = $('contractor-app-status');
    if (!el) return;
    el.className = 'contractor-status' + (error ? ' error' : '');
    el.textContent = message;
  };
  const api = async (path, options = {}) => {
    const response = await fetch(API_BASE + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value || 0));
  let contractors = [], tenders = [], bids = [], updates = [];

  async function refresh() {
    try {
      const [cs, ts, bs, us] = await Promise.all([
        api('/api/contractors'), api('/api/tenders'), api('/api/bids'), api('/api/repair-updates')
      ]);
      contractors = cs.contractors || []; tenders = ts.tenders || []; bids = bs.bids || []; updates = us.updates || [];
      renderContractors(); renderTenders(); renderBids(); renderUpdates();
    } catch (err) { status(`${err.message}. Ensure the Python server is running.`, true); }
  }
  function renderContractors() {
    const select = $('bid-contractor-select'); if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Select registered contractor</option>' + contractors.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)} (${esc(c.id)})</option>`).join('');
    if (contractors.some(c => c.id === previous)) select.value = previous;
  }
  function renderTenders() {
    const el = $('tender-list'); if (!el) return;
    if (!tenders.length) { el.innerHTML = '<p class="contractor-note">No tenders published yet. Create a tender above to begin.</p>'; return; }
    el.innerHTML = tenders.map(t => {
      const linked = (t.defect_ids || []).join(', ') || 'No linked defect IDs';
      const bidForm = t.status === 'Open' ? `<form data-bid-tender="${esc(t.id)}">
        <label>Bid amount (₹)<input name="bid_amount" type="number" min="1" max="${Number(t.estimated_budget)}" step="1" required></label>
        <label>Duration (days)<input name="duration_days" type="number" min="1" step="1" required></label>
        <label class="full-row">Proposal / method statement<input name="proposal" placeholder="Materials, crew and repair method"></label>
        <button class="btn-primary full-row" type="submit">Submit Bid</button></form>` : `<p><strong>Awarded to:</strong> ${esc(t.selected_company || 'Selected contractor')}</p>`;
      return `<article class="tender-item"><h4>${esc(t.title)}</h4><p><strong>ID:</strong> ${esc(t.id)} · <strong>Status:</strong> ${esc(t.status)}</p><p><strong>Area:</strong> ${esc(t.area)}</p><p>${esc(t.description)}</p><p><strong>Budget:</strong> ${money(t.estimated_budget)} · <strong>Deadline:</strong> ${esc(t.deadline)}</p><p><strong>Linked defects:</strong> ${esc(linked)} · <strong>Bids:</strong> ${Number(t.bid_count || 0)}</p>${bidForm}</article>`;
    }).join('');
  }
  function renderBids() {
    const el = $('bid-review-list'); if (!el) return;
    if (!bids.length) { el.innerHTML = '<p class="contractor-note">No bids submitted yet.</p>'; return; }
    el.innerHTML = '<div class="tender-list">' + bids.map(b => {
      const award = b.status === 'Submitted' && tenders.some(t => t.id === b.tender_id && t.status === 'Open') ? `<button class="btn-primary" data-award-tender="${esc(b.tender_id)}" data-award-bid="${esc(b.id)}">Award to this contractor</button>` : '';
      return `<article class="tender-item"><h4>${esc(b.tender_title)}</h4><p><strong>Bid:</strong> ${money(b.bid_amount)} · <strong>Duration:</strong> ${Number(b.duration_days)} days</p><p><strong>Company:</strong> ${esc(b.company_name)} · <strong>Registration:</strong> ${esc(b.registration_no)}</p><p><strong>Status:</strong> ${esc(b.status)}</p><p>${esc(b.proposal || 'No proposal text supplied.')}</p>${award}</article>`;
    }).join('') + '</div>';
  }
  function renderUpdates() {
    const el = $('repair-progress-list'); if (!el) return;
    const awarded = tenders.filter(t => t.status === 'Awarded');
    const form = awarded.length ? `<form id="repair-update-form" style="margin:12px 0 18px;max-width:760px">
      <label>Tender<select name="tender_id" required>${awarded.map(t => `<option value="${esc(t.id)}">${esc(t.title)} — ${esc(t.id)}</option>`).join('')}</select></label>
      <label>Assigned contractor<select name="contractor_id" required>${contractors.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)}</option>`).join('')}</select></label>
      <label>Progress complete (%)<input name="percent_complete" type="number" min="0" max="100" required></label>
      <label>Work update / inspection note<input name="note" required placeholder="e.g. base repaired, compaction underway"></label>
      <label>Evidence photo URL (optional)<input name="photo_url" type="url" placeholder="https://..."></label>
      <button class="btn-primary" type="submit">Submit Progress Update</button></form>` : '<p class="contractor-note">Award a tender to a contractor before submitting progress updates.</p>';
    const timeline = updates.length ? updates.map(u => `<article class="tender-item"><h4>${esc(u.tender_title)}</h4><p><strong>${esc(u.company_name)}</strong> · ${esc(u.created_at)}</p><div class="progress-track"><span style="width:${Math.max(0,Math.min(100,Number(u.percent_complete)))}%"></span></div><p><strong>${Number(u.percent_complete)}% complete</strong> — ${esc(u.note)}</p>${u.photo_url ? `<p><a href="${esc(u.photo_url)}" target="_blank" rel="noopener">View evidence photo</a></p>` : ''}</article>`).join('') : '<p class="contractor-note">No progress reports submitted yet.</p>';
    el.innerHTML = form + '<div class="tender-list">' + timeline + '</div>';
  }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  document.addEventListener('submit', async event => {
    const form = event.target;
    try {
      if (form.id === 'contractor-register-form') {
        event.preventDefault(); const result = await api('/api/contractors', {method:'POST', body:JSON.stringify(formObject(form))});
        status(`Contractor registered: ${result.contractor.company_name} (${result.contractor.id}). Save this ID for demo bidding.`); form.reset(); await refresh();
      } else if (form.id === 'tender-create-form') {
        event.preventDefault(); const d = formObject(form); d.estimated_budget = Number(d.estimated_budget); d.defect_ids = d.defect_ids ? d.defect_ids.split(',').map(x=>x.trim()).filter(Boolean) : []; delete d.password;
        const result = await api('/api/tenders', {method:'POST', body:JSON.stringify(d)}); status(`Tender published: ${result.tender_id}`); form.reset(); await refresh();
      } else if (form.matches('[data-bid-tender]')) {
        event.preventDefault(); const d = formObject(form); d.tender_id = form.dataset.bidTender; d.contractor_id = $('bid-contractor-select').value;
        if (!d.contractor_id) throw new Error('Register and select a contractor before bidding.');
        d.bid_amount = Number(d.bid_amount); d.duration_days = Number(d.duration_days);
        const result = await api('/api/bids', {method:'POST', body:JSON.stringify(d)}); status(`Bid submitted successfully: ${result.bid_id}`); await refresh();
      } else if (form.id === 'repair-update-form') {
        event.preventDefault(); const d = formObject(form); d.percent_complete = Number(d.percent_complete);
        await api('/api/repair-updates', {method:'POST', body:JSON.stringify(d)}); status('Repair progress saved to the audit trail.'); await refresh();
      }
    } catch (err) { status(err.message, true); }
  });
  document.addEventListener('click', async event => {
    const award = event.target.closest('[data-award-tender]');
    if (award) {
      try { await api('/api/tenders/award', {method:'POST',body:JSON.stringify({tender_id:award.dataset.awardTender,bid_id:award.dataset.awardBid})}); status('Tender awarded and contractor assigned.'); await refresh(); }
      catch (err) { status(err.message, true); }
    }
  });
  $('contractor-refresh-btn')?.addEventListener('click', refresh);
  // Fetch only when this page module loads; safe if the user opens the tab later.
  document.addEventListener('DOMContentLoaded', refresh);
  if (document.readyState !== 'loading') refresh();

  // Auto-poll the contractor tab every 10s so progress updates from contractors appear in real-time
  let _adminPollTimer = null;
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tab="contractors"]')) {
      refresh();
      clearInterval(_adminPollTimer);
      _adminPollTimer = setInterval(refresh, 10000);
    } else if (!e.target.closest('#tab-contractors')) {
      clearInterval(_adminPollTimer);
    }
  });
})();
