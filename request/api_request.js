document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform = document.getElementById("platform").value;
    const reason = document.getElementById("reason").value.trim();

    if (!usernameOrId || !reason) return;

    try {
        if (platform.toLowerCase() === "roblox") {
            const userInfo = await getRobloxUserData(usernameOrId);
            if (userInfo) await generatePDF(userInfo, reason, platform);
        }
    } catch (err) {
        console.error("[ERROR] handleBGCFormSubmit:", err);
    }
}

async function fetchFromWorker(url) {
    const response = await fetch(`${WORKER_URL}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`Failed fetch: ${url}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return await response.json();
    return await response.text();
}

async function getRobloxUserData(input) {
    let userId = input;

    // Resolve username → userId
    if (isNaN(input)) {
        const searchData = await fetchFromWorker(
            `https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`
        );
        if (!searchData.data || searchData.data.length === 0) return null;
        userId = searchData.data[0].id;
    }

    // Basic user data
    const userData = await fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`);

    // Avatar (fixed format)
    const avatarData = await fetchFromWorker(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    );

    // Friends
    let friendsCount = 0;
    try {
        const friendsData = await fetchFromWorker(
            `https://friends.roblox.com/v1/users/${userId}/friends/count`
        );
        friendsCount = friendsData.count || 0;
    } catch {}

    // Groups
    let groupsData = [];
    try {
        const groups = await fetchFromWorker(
            `https://groups.roblox.com/v2/users/${userId}/groups/roles`
        );
        groupsData = groups.data ? groups.data.map(g => g.group.name) : [];
    } catch {}

    // Badges
    let badgesCount = 0;
    try {
        const badges = await fetchFromWorker(
            `https://badges.roblox.com/v1/users/${userId}/badges?limit=100`
        );
        badgesCount = badges.data ? badges.data.length : 0;
    } catch {}

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        created: userData.created,
        banned: userData.isBanned,
        avatar: avatarData?.data?.[0]?.imageUrl || null,
        friendsCount,
        groups: groupsData,
        badgesCount,
    };
}

async function loadImageAsDataURL(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

async function generatePDF(userInfo, reason, platform) {
    if (!userInfo) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Red warning
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(12);
    doc.text("⚠ WARNING: This tool can be inaccurate.", 10, 15);

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text(`${platform} Background Check Report`, 10, 25);

    // Info
    doc.setFontSize(12);
    doc.text(`Reason: ${reason}`, 10, 35);
    doc.text(`ID: ${userInfo.id}`, 10, 45);
    doc.text(`Username: ${userInfo.username}`, 10, 55);
    doc.text(`Display Name: ${userInfo.displayName}`, 10, 65);
    doc.text(`Created: ${new Date(userInfo.created).toLocaleString()}`, 10, 75);
    doc.text(`Banned: ${userInfo.banned}`, 10, 85);
    doc.text(`Friends: ${userInfo.friendsCount}`, 10, 95);
    doc.text(`Badges: ${userInfo.badgesCount}`, 10, 105);

    // Groups (truncate if too long)
    const groups = userInfo.groups.length
        ? userInfo.groups.slice(0, 5).join(", ") +
          (userInfo.groups.length > 5 ? " ..." : "")
        : "None";
    doc.text(`Groups: ${groups}`, 10, 115);

    // Avatar image
    const avatarDataURL = await loadImageAsDataURL(userInfo.avatar);
    if (avatarDataURL) doc.addImage(avatarDataURL, "PNG", 150, 20, 40, 40);

    doc.save(`${userInfo.username}_BGC_Report.pdf`);
}
