import type { Locale } from "@/lib/i18n/config";

const words = (list: string) => list.split(/\s+/).filter(Boolean);

/**
 * Slurs that rule out a whole book passage, not just a word in the random
 * lists. Kept separate from BLOCKLIST, which also holds harmless noise
 * ("black", first names) and words that are fine in the other language
 * ("retard" means "delay" in French).
 */
export const SLURS: Record<Locale, string[]> = {
  en: words(`nigger nigga niggah negro negress coon darky darkey darkie
    kike spic chink wetback faggot fag dyke tranny`),
  fr: words(`nègre négresse négro bougnoule bicot youpin youpine pédé
    tarlouze gouine`),
};

/** Whole words only, plus their plural, so "niggard" or "cooney" stay allowed. */
export function containsSlur(text: string, language: Locale): boolean {
  const slurs = new Set(SLURS[language]);
  for (const [token] of text.toLowerCase().matchAll(/\p{L}+/gu)) {
    if (slurs.has(token) || (token.endsWith("s") && slurs.has(token.slice(0, -1)))) {
      return true;
    }
  }
  return false;
}

/**
 * Words removed by hand after reading the generated lists. Subtitles are the
 * frequency source, so most of the noise comes from them: swear words and
 * slurs, slang and interjections, sound captions ("sighs"), first names,
 * and English lines inside French subtitles.
 */
export const BLOCKLIST: Record<Locale, string[]> = {
  en: words(`
    fuck fucking fucked fucker fuckers fuckin motherfucker motherfuckers shit
    shits shitty bullshit ass asses asshole assholes arse arsehole bitch bitches
    bastard bastards damn damned dammit goddamn goddamned crap dick dicks cock
    cocks pussy cunt twat wanker bollocks tits boobs slut sluts whore whores
    piss pissed turd scum fag faggot nigger nigga retard retarded sex sexy
    gonna wanna gotta kinda sorta outta dunno lemme gimme ain yeah yep yup nope
    nah hey ok okay uh huh hmm mm mmm ooh ohh aah ahh shh whoa wow oops ugh
    yo bro dude hon ma pa mom mommy wha doin goin ya ah um em er ha ho aw ow
    eh whoo hm la de da th sh

    sighs laughs chuckles grunts gasps grunting groans groaning panting
    chuckling scoffs gasping sobbing exhales coughing coughs giggles sighing
    whimpering giggling dings sobs sniffles sniffs ding chuckle whimpers
    inhales snoring sniffing muttering grunt snorts groan mutters sniffling
    narrator applause cheering beeping bleep

    sam mike ben harry bob nick jimmy tony ray lee billy tommy martin bobby
    roger kim dan anna eric al pete larry jerry alan kelly walter laura carl
    rick luke rob josh ted dean sue chuck kyle clark hank blake morgan barry
    terry mac molly carol sally jean donna jay steven bud mason jordan betty
    holly brad ken nancy cliff beth randy ann earl kit gene ralph cole toby
    sandy ruth marco willie sonny warren graham travis colin spencer heather
    wade lance seth franklin troy rex barney dale walt hector peggy perry rusty
    spike pam pierce mick rod alison benjamin brandy morris woody kay rodney
    patty lin kirk pablo raj manny marc blair fletcher elaine shaw neal marsh
    brett tammy glen cyrus deb laurel po milo lori norm herb brent raja jock
    alf norma dalton timothy tai gale allan hazel trey tad ariel ginny kerry
    eddy marguerite tao lea barton kiki rand dirk mat ping jenna singh murphy
    bailey gibbs gabi dolores wong barnes burke sophia alec griffin
    horny pimp suck sucks sucking sucked porn porno
  `),
  fr: words(`
    putain merde merdes bordel con cons conne connes connard connards connasse
    salaud salauds salope salopes enculé enculés encule enfoiré enfoirés foutre
    foutu foutue chier chiant chiante bite bites couilles cul nichons gueule
    conneries pute putes pd pédé pédés nègre bougnoule fric sexy
    ouais ouai ok okay hein euh heu bah ben hé hey wow yeah bye hum ah oh eh
    ha hop allô allo chut ouf aïe bof mec mecs meuf flic flics keuf mlle km

    to for have do not are but go if out about let back look tell man by more
    down people love off girl house came boy baby live hard kid deal party fun
    show home business sure nice ya girls game stand break city team boys news
    light country hot black boss promise drive song gentlemen clean state
    building box short trip relax green cash support mate river suit roll gold
    soul records rush tickets re da assume data golden plate bang crack
    shopping mail rate boom punch toast marks grade yard loser sports slip los
    arrange bat cap bond fans motion western timing gray offense chips bush pin
    cries li pro crane cookies pan dope web lame mi rangers bacon burger
    masters ace yang khan han hui qu puisqu chester

    jack tom max henry bob bill mary richard tommy mark bobby dan walter lois
    carter maria louis cris karen mac donna miles robin oliver caroline roy
    barbara diane spencer ron oscar jacob bonnie kit dale juan colin marc
    franklin benjamin blair pat hunter brandon lloyd marcel isabelle douglas
    rex lester claude luis valentin gail lori archie ramon devon chip mara cary
    fritz gretchen brandy kiki maya sammy jenny margot carole ana rosa bishop
    vagin sucer suce caca sexe sexuel sexuelle sexuels sexuelles porno
  `),
};
