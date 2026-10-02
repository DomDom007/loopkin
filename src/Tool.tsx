// Loopkin: a split sheet every collaborator signs by link before a track ships, plus a payout calculator.
import { useState } from "react";
import { moneyFmt } from "./lib/money";
import { openLater, shareLink, waLink } from "./lib/share";
import { uid, useCopy, useStored } from "./lib/store";
import { useShared } from "./lib/useShared";
import { CurrencySelect, Section, SharedNotice } from "./ui/kit";

const T = "loopkin";
type Person = { id: string; name: string; role: string; writing: number; master: number; sig?: { name: string; at: string } };
type Sheet = { id: string; title: string; date: string; people: Person[] };

const SAMPLE: Sheet = {
  id: "s1", title: "Salt Road (demo)", date: new Date().toISOString().slice(0, 10),
  people: [
    { id: "p1", name: "Yasmine K.", role: "Topline and lyrics", writing: 40, master: 30 },
    { id: "p2", name: "Omar B.", role: "Producer", writing: 30, master: 50 },
    { id: "p3", name: "Dali", role: "Guitar and co-writer", writing: 30, master: 20 },
  ],
};
const total = (s: Sheet, k: "writing" | "master") => Math.round(s.people.reduce((a, p) => a + (p[k] || 0), 0) * 100) / 100;

function SheetView({ sheet }: { sheet: Sheet }) {
  return (
    <div className="table-wrap"><table className="t">
      <thead><tr><th>Name</th><th>Role</th><th className="r">Writing</th><th className="r">Master</th><th>Signed</th></tr></thead>
      <tbody>{sheet.people.map(p => (
        <tr key={p.id}><td>{p.name}</td><td>{p.role}</td><td className="r">{p.writing}%</td><td className="r">{p.master}%</td>
          <td>{p.sig ? <span className="pill good">{p.sig.name} · {p.sig.at.slice(0, 10)}</span> : <span className="pill warn">Not yet</span>}</td></tr>
      ))}</tbody>
    </table></div>
  );
}

export default function Loopkin() {
  const [sheets, setSheets] = useStored<Sheet[]>(T, "sheets", [SAMPLE]);
  const [openId, setOpenId] = useStored(T, "open", SAMPLE.id);
  const [currency, setCurrency] = useStored(T, "cur", "USD");
  const [payout, setPayout] = useState({ amount: "1000", kind: "writing" as "writing" | "master" });
  const shared = useShared<Sheet>();
  const [signer, setSigner] = useState({ who: "", name: "", agree: false });
  const [signedLink, setSignedLink] = useState("");
  const { copy, copied } = useCopy();
  const money = moneyFmt(currency);

  // Someone opened a share link.
  if (shared.loading) return <p className="empty-note">Opening split sheet…</p>;
  if (shared.error) return <p className="empty-note">{shared.error}</p>;
  if (shared.data) {
    const s = shared.data;
    const mine = sheets.find(x => x.id === s.id);
    const newSigs = mine ? s.people.filter(p => p.sig && !mine.people.find(m => m.id === p.id)?.sig) : [];
    return (
      <div className="stack">
        <SharedNotice>
          <p className="eyebrow">Split sheet</p>
          <h2 style={{ fontSize: 34, margin: "6px 0 10px" }}>{s.title}</h2>
          <SheetView sheet={s} />
        </SharedNotice>
        {mine && newSigs.length > 0 && (
          <div className="panel row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <p>This link has new signatures from {newSigs.map(p => p.name).join(", ")}.</p>
            <button className="btn primary" onClick={() => { setSheets(sheets.map(x => x.id === s.id ? { ...x, people: x.people.map(p => ({ ...p, sig: p.sig ?? s.people.find(q => q.id === p.id)?.sig })) } : x)); setOpenId(s.id); history.replaceState(null, "", "/t/loopkin"); location.reload(); }}>Add signatures to my sheet</button>
          </div>
        )}
        {!mine && (
          <section className="panel stack" style={{ gap: 12, maxWidth: 560 }}>
            <h2>Sign this split</h2>
            <label className="field"><span>I am</span><select id="lk-who" className="input" value={signer.who} onChange={e => setSigner({ ...signer, who: e.target.value })}><option value="">Choose your name</option>{s.people.filter(p => !p.sig).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="field"><span>Type your full name as a signature</span><input id="lk-sig" className="input" value={signer.name} onChange={e => setSigner({ ...signer, name: e.target.value })} style={{ fontFamily: "var(--serif)", fontSize: 22 }} /></label>
            <label className="check"><input type="checkbox" checked={signer.agree} onChange={e => setSigner({ ...signer, agree: e.target.checked })} />I agree to the percentages above for “{s.title}”.</label>
            <button className="btn primary" disabled={!signer.who || signer.name.trim().length < 3 || !signer.agree} onClick={async () => {
              const signed = { ...s, people: s.people.map(p => p.id === signer.who ? { ...p, sig: { name: signer.name.trim(), at: new Date().toISOString() } } : p) };
              setSignedLink(await shareLink(T, signed, "m=sign"));
            }}>Sign</button>
            {signedLink && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="pill good">Signed. Now send this link back to whoever sent you the sheet.</span>
                <div className="row"><button className="btn" onClick={() => copy(signedLink)}>{copied ? "Copied" : "Copy link"}</button><a className="btn" href={waLink(`I signed the split for ${s.title}: ${signedLink}`)} target="_blank" rel="noreferrer">Send on WhatsApp</a></div>
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  const sheet = sheets.find(s => s.id === openId) ?? sheets[0];
  const update = (patch: Partial<Sheet>) => setSheets(sheets.map(s => (s.id === sheet.id ? { ...s, ...patch } : s)));
  const setP = (id: string, patch: Partial<Person>) => update({ people: sheet.people.map(p => (p.id === id ? { ...p, ...patch, sig: undefined } : p)) });
  const tw = sheet ? total(sheet, "writing") : 0, tm = sheet ? total(sheet, "master") : 0;
  const signedAll = sheet?.people.every(p => p.sig);

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "center" }}>
        <label className="field" style={{ flex: "0 1 320px" }}><span>Track</span><select id="lk-open" className="input" value={sheet?.id} onChange={e => setOpenId(e.target.value)}>{sheets.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <button className="btn small" style={{ alignSelf: "flex-end" }} onClick={() => { const s = { id: uid(), title: "New track", date: new Date().toISOString().slice(0, 10), people: [{ id: uid(), name: "", role: "", writing: 100, master: 100 }] }; setSheets([...sheets, s]); setOpenId(s.id); }}>New split sheet</button>
      </div>
      {sheet && <>
        <Section title="Split sheet" aside={signedAll ? <span className="pill good">Everyone has signed</span> : <span className="pill warn">{sheet.people.filter(p => !p.sig).length} signatures missing</span>}>
          <div className="row" style={{ marginBottom: 14 }}>
            <label className="field" style={{ flexGrow: 3 }}><span>Track title</span><input id="lk-title" className="input" value={sheet.title} onChange={e => update({ title: e.target.value })} /></label>
            <label className="field"><span>Date</span><input id="lk-date" type="date" className="input" value={sheet.date} onChange={e => update({ date: e.target.value })} /></label>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {sheet.people.map(p => (
              <div key={p.id} className="row">
                <label className="field"><span>Name</span><input id={`lk-n-${p.id}`} className="input" value={p.name} onChange={e => setP(p.id, { name: e.target.value })} /></label>
                <label className="field"><span>Role</span><input id={`lk-r-${p.id}`} className="input" value={p.role} onChange={e => setP(p.id, { role: e.target.value })} /></label>
                <label className="field" style={{ flexBasis: 80 }}><span>Writing %</span><input id={`lk-w-${p.id}`} className="input num" inputMode="decimal" value={p.writing} onChange={e => setP(p.id, { writing: parseFloat(e.target.value) || 0 })} /></label>
                <label className="field" style={{ flexBasis: 80 }}><span>Master %</span><input id={`lk-m-${p.id}`} className="input num" inputMode="decimal" value={p.master} onChange={e => setP(p.id, { master: parseFloat(e.target.value) || 0 })} /></label>
                <button className="btn ghost small danger" onClick={() => update({ people: sheet.people.filter(x => x.id !== p.id) })}>Remove</button>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
            <button className="btn small" onClick={() => update({ people: [...sheet.people, { id: uid(), name: "", role: "", writing: 0, master: 0 }] })}>Add a collaborator</button>
            <span className={"pill " + (tw === 100 ? "good" : "bad")}>Writing {tw}%</span>
            <span className={"pill " + (tm === 100 ? "good" : "bad")}>Master {tm}%</span>
            <span className="note">Changing a row clears that person's signature.</span>
          </div>
        </Section>

        <div className="grid2">
          <Section title="Collect signatures">
            {tw !== 100 || tm !== 100 ? <p className="empty-note">Both columns must add up to 100% before anyone signs.</p> : <>
              <SheetView sheet={sheet} />
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={async () => copy(await shareLink(T, sheet, "m=sign"))}>{copied ? "Link copied" : "Copy signing link"}</button>
                <button className="btn" onClick={() => openLater(async () => waLink(`Please sign the split sheet for ${sheet.title}: ${await shareLink(T, sheet, "m=sign")}`))}>Send on WhatsApp</button>
              </div>
              <p className="note" style={{ marginTop: 8 }}>Each person signs and sends a link back. Open it here to add their signature.</p>
            </>}
          </Section>
          <Section title="Payout calculator">
            <div className="row">
              <label className="field"><span>Amount received</span><input id="lk-amt" className="input num" inputMode="decimal" value={payout.amount} onChange={e => setPayout({ ...payout, amount: e.target.value })} /></label>
              <label className="field"><span>Type</span><select id="lk-kind" className="input" value={payout.kind} onChange={e => setPayout({ ...payout, kind: e.target.value as "writing" | "master" })}><option value="writing">Publishing (writing)</option><option value="master">Master (recording)</option></select></label>
              <CurrencySelect id="lk-cur" value={currency} onChange={setCurrency} />
            </div>
            <table className="t" style={{ marginTop: 12 }}><tbody>
              {sheet.people.map(p => <tr key={p.id}><td>{p.name || "Unnamed"}</td><td className="r">{p[payout.kind]}%</td><td className="r"><strong>{money(((parseFloat(payout.amount) || 0) * (p[payout.kind] || 0)) / 100)}</strong></td></tr>)}
            </tbody></table>
          </Section>
        </div>
        <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => window.print()}>Print the signed sheet</button>
      </>}
    </div>
  );
}
