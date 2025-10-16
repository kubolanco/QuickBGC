document.addEventListener("DOMContentLoaded", () => {
    console.log("[DEBUG] DOM loaded, setting up form listener");
    const form = document.getElementById("bgcForm");

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        console.log("[DEBUG] Form submitted");
        handleBGCFormSubmit();
    });
});

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform     = document.getElementById("platform").value;
    const reason       = document.getElementById("reason").value.trim();

    console.log("[DEBUG] Form values:", { usernameOrId, platform, reason });

    if (!usernameOrId || !reason) {
        console.log("[DEBUG] Missing username or reason, aborting");
        return;
    }

    try {
        if (platform.toLowerCase() === "roblox") {
            const userInfo = await getRobloxFullInfo(usernameOrId);
            console.log("[DEBUG] Full Roblox info:", userInfo);
            if (userInfo) await generatePDF(userInfo, reason, platform);
        } else {
            console.log("[DEBUG] Platform not supported:", platform);
        }
    } catch (err) {
        console.error("[DEBUG] Error in handleBGCFormSubmit:", err);
    }
}

// Fetch all public Roblox info using AllOrigins proxy
async function getRobloxFullInfo(input) {
    const proxyUrl = "https://api.allorigins.win/raw?url=";
    let userId = input;

    try {
        // Resolve username to ID if needed
        if (isNaN(input)) {
            const searchUrl = encodeURIComponent(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`);
            console.log("[DEBUG] Searching username via proxy:", proxyUrl + searchUrl);
            const searchRes = await fetch(proxyUrl + searchUrl);
            const searchData = await searchRes.json();
            console.log("[DEBUG] Search response:", searchData);
            if (!searchData.data || searchData.data.length === 0) return null;
            userId = searchData.data[0].id;
            console.log("[DEBUG] Resolved user ID:", userId);
        }

        // User basic info
        const userRes = await fetch(proxyUrl + encodeURIComponent(`https://users.roblox.com/v1/users/${userId}`));
        const userData = await userRes.json();
        console.log("[DEBUG] User data:", userData);

        // Avatar
        const avatarRes = await fetch(proxyUrl + encodeURIComponent(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=48x48&format=Png`));
        const avatarData = await avatarRes.json();
        console.log("[DEBUG] Avatar data:", avatarData);

        // Description
        const descRes = await fetch(proxyUrl + encodeURIComponent(`https://users.roblox.com/v1/users/${userId}`));
        const descData = await descRes.json();
        console.log("[DEBUG] Description:", descData.description);

        // Friends count
        const friendsRes = await fetch(proxyUrl + encodeURIComponent(`https://friends.roblox.com/v1/users/${userId}/friends`));
        const friendsData = await friendsRes.json();
        console.log("[DEBUG] Friends data:", friendsData);

        // Followers count
        const followersRes = await fetch(proxyUrl + encodeURIComponent(`https://friends.roblox.com/v1/users/${userId}/followers`));
        const followersData = await followersRes.json();
        console.log("[DEBUG] Followers data:", followersData);

        // Groups
        const groupsRes = await fetch(proxyUrl + encodeURIComponent(`https://groups.roblox.com/v1/users/${userId}/groups/roles`));
        const groupsData = await groupsRes.json();
        console.log("[DEBUG] Groups data:", groupsData);

        // Badges
        const badgesRes = await fetch(proxyUrl + encodeURIComponent(`https://badges.roblox.com/v1/users/${userId}/badges`));
        const badgesData = await badgesRes.json();
        console.log("[DEBUG] Badges data:", badgesData);

        // Presence
        const presenceRes = await fetch(proxyUrl + encodeURIComponent(`https://presence.roblox.com/v1/presence/users`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: [userId] })
        });
        const presenceData = await presenceRes.json();
        console.log("[DEBUG] Presence data:", presenceData);

        return {
            id: userData.id,
            username: userData.name,
            displayName: userData.displayName,
            created: userData.created,
            description: descData.description,
            banned: userData.isBanned,
            avatar: avatarData.data[0].imageUrl,
            friendsCount: friendsData.count ?? friendsData.data?.length ?? 0,
            followersCount: followersData.count ?? followersData.data?.length ?? 0,
            groups: groupsData,
            badges: badgesData.data,
            presence: presenceData.userPresences?.[0] ?? {}
        };
    } catch (err) {
        console.error("[DEBUG] Error fetching full Roblox info:", err);
        return null;
    }
}

// Convert avatar URL to base64 for PDF
async function loadImageAsDataURL(url) {
    console.log("[DEBUG] Loading image as Data URL:", url);
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log("[DEBUG] Image converted to Data URL");
                resolve(reader.result);
            };
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error("[DEBUG] Error loading image:", err);
        return null;
    }
}

// Generate and download PDF with max info
async function generatePDF(userInfo, reason, platform) {
    if (!userInfo) {
        console.log("[DEBUG] No user info, skipping PDF generation");
        return;
    }

    console.log("[DEBUG] Generating PDF for user:", userInfo.username);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`${platform} Background Check Report`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Reason: ${reason}`, 10, 30);
    doc.text(`ID: ${userInfo.id}`, 10, 40);
    doc.text(`Username: ${userInfo.username}`, 10, 50);
    doc.text(`Display Name: ${userInfo.displayName}`, 10, 60);
    doc.text(`Created: ${new Date(userInfo.created).toLocaleString()}`, 10, 70);
    doc.text(`Banned: ${userInfo.banned}`, 10, 80);
    doc.text(`Description: ${userInfo.description || "N/A"}`, 10, 90);
    doc.text(`Friends: ${userInfo.friendsCount}`, 10, 100);
    doc.text(`Followers: ${userInfo.followersCount}`, 10, 110);

    // Groups
    let groupY = 120;
    if (userInfo.groups.data && userInfo.groups.data.length > 0) {
        doc.text(`Groups:`, 10, groupY);
        userInfo.groups.data.forEach(group => {
            groupY += 10;
            doc.text(`- ${group.name} (Role: ${group.role.name})`, 12, groupY);
        });
    }

    // Badges
    let badgeY = groupY + 10;
    if (userInfo.badges && userInfo.badges.length > 0) {
        doc.text(`Badges:`, 10, badgeY);
        userInfo.badges.forEach(badge => {
            badgeY += 10;
            doc.text(`- ${badge.name}`, 12, badgeY);
        });
    }

    // Presence info
    const presenceY = badgeY + 10;
    if (userInfo.presence) {
        const lastOnline = userInfo.presence.lastOnline ? new Date(userInfo.presence.lastOnline).toLocaleString() : "N/A";
        doc.text(`Last Online: ${lastOnline}`, 10, presenceY);
        doc.text(`Game/Location: ${userInfo.presence.placeId ?? "N/A"}`, 10, presenceY + 10);
    }

    const avatarDataURL = await loadImageAsDataURL(userInfo.avatar);
    if (avatarDataURL) doc.addImage(avatarDataURL, "PNG", 150, 20, 40, 40);

    doc.save(`${userInfo.username}_BGC_Report.pdf`);
    console.log("[DEBUG] PDF saved for user:", userInfo.username);
}
